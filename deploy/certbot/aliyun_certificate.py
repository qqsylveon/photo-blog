#!/usr/bin/env python3
"""Certbot DNS hooks and retryable CDN certificate deployment; no stored AccessKey."""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import ssl
import sys
import time

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.x509.verification import PolicyBuilder, Store, VerificationError


DOMAIN = "img.qqsylveon.love"
ZONE = "qqsylveon.love"
RR = "_acme-challenge.img"
LINEAGE = Path("/etc/letsencrypt/live") / DOMAIN
TXT_NAME = f"{RR}.{ZONE}"
LOCK_FILE = Path("/var/lib/photo-blog-certbot/deployment.lock")


class HookError(RuntimeError):
    """A safe, locally written error message; never wrap a raw SDK message."""


class AliyunApi:
    """Official SDK signs POST bodies; PEM/key content never enters process argv."""

    def __init__(self, credential=None):
        # SDK debugging can log STS and IMDS tokens before exceptions reach us.
        os.environ.pop("DEBUG", None)
        for name in ("darabonba-core", "alibabacloud-tea", "credentials"):
            logging.getLogger(name).disabled = True
        from alibabacloud_credentials.client import Client as Credentials
        from alibabacloud_credentials.models import Config as CredentialsConfig
        from alibabacloud_tea_openapi.client import Client
        from alibabacloud_tea_openapi.models import Config

        credential = credential or Credentials(CredentialsConfig(
            type="ecs_ram_role", disable_imds_v1=True,
        ))
        self.clients = {
            service: Client(Config(
                credential=credential, endpoint=endpoint, region_id="cn-hangzhou",
                protocol="HTTPS",
            ))
            for service, endpoint in {
                "alidns": "alidns.cn-hangzhou.aliyuncs.com",
                "cdn": "cdn.aliyuncs.com",
            }.items()
        }

    def call(self, service, action, **body):
        from alibabacloud_tea_openapi.models import OpenApiRequest, Params
        from alibabacloud_tea_util.models import RuntimeOptions

        versions = {"alidns": "2015-01-09", "cdn": "2018-05-10"}
        try:
            result = self.clients[service].call_api(
                Params(
                    action=action, version=versions[service], protocol="HTTPS",
                    pathname="/", method="POST", auth_type="AK", style="RPC",
                    req_body_type="formData", body_type="json",
                ),
                OpenApiRequest(body=body),
                RuntimeOptions(
                    connect_timeout=5000, read_timeout=20000,
                    autoretry=True, max_attempts=2,
                ),
            )
            return result["body"]
        except Exception as exc:
            # SDK exceptions may embed the entire signed request, including SSLPri.
            code = str(getattr(exc, "code", "SDKError"))
            if not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", code):
                code = "SDKError"
            raise HookError(f"{service}/{action} failed: {code}") from None


@contextmanager
def deployment_lock(path):
    """One OS lock shared by manual sync, the timer, and Certbot's deploy hook."""
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        try:
            if os.name == "nt":
                import msvcrt
                handle.seek(0, 2)
                if handle.tell() == 0:
                    handle.write(b"\0")
                    handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise HookError("Another certificate sync is running; retry later") from None
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def validate_challenge(domain, value):
    if domain != DOMAIN:
        raise HookError("DNS hooks only support img.qqsylveon.love")
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,256}", value or ""):
        raise HookError("Missing or invalid ACME validation value")


def matching_records(api, value):
    response = api.call(
        "alidns", "DescribeDomainRecords", DomainName=ZONE, SearchMode="COMBINATION",
        RRKeyWord=RR, Type="TXT", ValueKeyWord=value, PageSize=500, PageNumber=1,
    )
    if int(response.get("TotalCount", 0)) > 500:
        raise HookError("Too many matching DNS records; inspect the challenge manually")
    return [
        record for record in response.get("DomainRecords", {}).get("Record", [])
        if record.get("RR") == RR and record.get("Type") == "TXT"
        and record.get("Value") == value and record.get("Status", "Enable") == "Enable"
    ]


def authenticate(api, wait_for_txt, domain, value):
    validate_challenge(domain, value)
    records = matching_records(api, value)
    owned = not records
    if owned:
        record_id = api.call(
            "alidns", "AddDomainRecord", DomainName=ZONE, RR=RR,
            Type="TXT", Value=value, TTL=600,
        )["RecordId"]
    else:
        record_id = records[0]["RecordId"]
    marker = {"domain": domain, "validation": value,
              "record_id": str(record_id), "owned": owned}
    try:
        wait_for_txt(TXT_NAME, value)
    except Exception:
        if owned:
            try:
                cleanup(api, marker, domain, value)
            except Exception:
                raise HookError("DNS validation and cleanup failed; inspect the challenge TXT record") from None
        raise
    return marker


def cleanup(api, marker, domain, value):
    validate_challenge(domain, value)
    if not isinstance(marker, dict) or marker.get("domain") != domain or marker.get("validation") != value:
        raise HookError("Cleanup marker does not match this ACME challenge")
    if marker.get("owned") is not True:
        return
    record_id = marker.get("record_id")
    if not isinstance(record_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", record_id):
        raise HookError("Invalid DNS cleanup record ID")
    if any(str(record["RecordId"]) == record_id for record in matching_records(api, value)):
        api.call("alidns", "DeleteDomainRecord", RecordId=record_id)


def wait_for_dns(name, value):
    import dns.flags
    import dns.message
    import dns.query
    import dns.rdatatype
    import dns.resolver

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 10
    try:
        servers = []
        for ns in resolver.resolve(ZONE, "NS"):
            addresses = resolver.resolve(str(ns.target), "A")
            servers.append(str(addresses[0]))
        if not servers:
            raise HookError("No authoritative DNS servers found")
    except Exception:
        raise HookError("Cannot discover authoritative DNS servers") from None

    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        ready = True
        for address in servers:
            try:
                query = dns.message.make_query(name, dns.rdatatype.TXT)
                response = dns.query.udp(query, address, timeout=4)
                if response.flags & dns.flags.TC:
                    response = dns.query.tcp(query, address, timeout=4)
                values = {
                    b"".join(item.strings).decode("ascii")
                    for answer in response.answer
                    if answer.rdtype == dns.rdatatype.TXT
                    and answer.name.to_text().rstrip(".").lower() == name.lower()
                    for item in answer
                }
                if not response.flags & dns.flags.AA or value not in values:
                    ready = False
            except Exception:
                ready = False
        if ready:
            # Let public recursive resolvers catch up after authoritative readiness.
            print("DNS is ready; allowing 120 seconds for propagation", file=sys.stderr)
            time.sleep(120)
            return
        time.sleep(10)
    raise HookError("DNS propagation timed out; existing unrelated records were preserved")


@dataclass(frozen=True)
class Bundle:
    certificate: str
    private_key: str
    fingerprint: str
    expires: datetime


def system_roots():
    return [
        x509.load_der_x509_certificate(der)
        for der in ssl.create_default_context().get_ca_certs(binary_form=True)
    ]


def validate_bundle(certificate, private_key, roots):
    try:
        chain = x509.load_pem_x509_certificates(certificate)
        if not chain or not roots:
            raise HookError("Missing certificate chain or system trust store")
        leaf = chain[0]
        key = serialization.load_pem_private_key(private_key, password=None)
        if not isinstance(key, (rsa.RSAPrivateKey, ec.EllipticCurvePrivateKey)):
            raise HookError("CDN deployment supports RSA or EC keys only")
        public_format = (serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        if leaf.public_key().public_bytes(*public_format) != key.public_key().public_bytes(*public_format):
            raise HookError("Certificate and private key do not match")
        verifier = (
            PolicyBuilder().store(Store(roots)).time(datetime.now(timezone.utc))
            .build_server_verifier(x509.DNSName(DOMAIN))
        )
        verifier.verify(leaf, chain[1:])
        # CDN accepts traditional PEM keys; Certbot can write PKCS#8 keys.
        key_pem = key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ).decode("ascii")
        return Bundle(
            certificate.decode("ascii"), key_pem,
            leaf.fingerprint(hashes.SHA256()).hex(), leaf.not_valid_after_utc,
        )
    except HookError:
        raise
    except (ValueError, TypeError, VerificationError):
        raise HookError("Certificate validation failed: check hostname, chain, validity, and key") from None


def load_bundle(lineage):
    try:
        chain_file, key_file = Path(lineage) / "fullchain.pem", Path(lineage) / "privkey.pem"
        if chain_file.stat().st_size > 1024 * 1024 or key_file.stat().st_size > 64 * 1024:
            raise HookError("Certificate or key file is unexpectedly large")
        return validate_bundle(chain_file.read_bytes(), key_file.read_bytes(), system_roots())
    except OSError:
        raise HookError("Cannot read the image certificate lineage") from None


def synchronize(api, bundle):
    response = api.call("cdn", "DescribeDomainCertificateInfo", DomainName=DOMAIN)
    infos = response.get("CertInfos", {}).get("CertInfo", [])
    for info in infos:
        if info.get("DomainName") != DOMAIN or not info.get("ServerCertificate"):
            continue
        try:
            remote = x509.load_pem_x509_certificate(info["ServerCertificate"].encode("ascii"))
        except (ValueError, UnicodeError):
            raise HookError("Cannot parse the current CDN certificate; refusing to overwrite blindly") from None
        if remote.fingerprint(hashes.SHA256()).hex() == bundle.fingerprint:
            if info.get("ServerCertificateStatus") == "on":
                return "unchanged"
        elif remote.not_valid_after_utc > bundle.expires:
            raise HookError("CDN already has a newer certificate; refusing to roll it back")

    api.call(
        "cdn", "SetCdnDomainSSLCertificate", DomainName=DOMAIN,
        SSLProtocol="on", CertType="upload",
        CertName=f"photo-blog-{bundle.fingerprint[:32]}",
        SSLPub=bundle.certificate, SSLPri=bundle.private_key,
    )
    return "updated"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("auth", "cleanup", "sync", "check"))
    parser.add_argument("--lineage", type=Path, default=LINEAGE)
    args = parser.parse_args(argv)
    try:
        if args.command == "sync":
            renewed = os.environ.get("RENEWED_DOMAINS")
            if renewed is not None and set(renewed.split()) != {DOMAIN}:
                print("Skipping deploy hook for an unrelated certificate", file=sys.stderr)
                return 0
            lineage = Path(os.environ.get("RENEWED_LINEAGE") or args.lineage)
            with deployment_lock(LOCK_FILE):
                bundle = load_bundle(lineage)
                print(f"CDN certificate: {synchronize(AliyunApi(), bundle)}", file=sys.stderr)
        elif args.command == "check":
            api = AliyunApi()
            matching_records(api, "read-only-connection-check")
            api.call("cdn", "DescribeDomainCertificateInfo", DomainName=DOMAIN)
            print("ECS role can read the DNS zone and image CDN certificate", file=sys.stderr)
        else:
            domain = os.environ.get("CERTBOT_IDENTIFIER") or os.environ.get("CERTBOT_DOMAIN", "")
            value = os.environ.get("CERTBOT_VALIDATION", "")
            validate_challenge(domain, value)
            if args.command == "auth":
                print(json.dumps(authenticate(AliyunApi(), wait_for_dns, domain, value)))
            else:
                output = os.environ.get("CERTBOT_AUTH_OUTPUT", "").strip()
                if not output:
                    # Auth may fail before creating a record; there is nothing owned to delete.
                    return 0
                cleanup(AliyunApi(), json.loads(output), domain, value)
        return 0
    except HookError as exc:
        print(f"Certificate automation failed: {exc}", file=sys.stderr)
    except Exception:
        # No traceback or raw SDK exception: either can contain secrets/PEM request bodies.
        print("Certificate automation failed; inspect installation, permissions, and connectivity", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
