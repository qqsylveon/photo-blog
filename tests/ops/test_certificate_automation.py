"""Offline safety tests: DNS/cloud writes are simulated, certificates are real."""

import importlib.util
import io
import json
import logging
from contextlib import nullcontext, redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "aliyun_certificate", ROOT / "deploy/certbot/aliyun_certificate.py"
)
hooks = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = hooks
SPEC.loader.exec_module(hooks)
DOMAIN = "img.qqsylveon.love"
VALUE = "abcDEF0123456789_abcDEF0123456789-abcDEF01234"


class FakeCloud:
    def __init__(self, records=None, remote=None, upload_error=None):
        self.records = list(records or [])
        self.remote = remote
        self.upload_error = upload_error
        self.uploads = []
        self.deleted = []
        self.calls = []

    def call(self, service, action, **params):
        self.calls.append((service, action, params))
        if action == "DescribeDomainRecords":
            return {"TotalCount": len(self.records), "DomainRecords": {"Record": self.records}}
        if action == "AddDomainRecord":
            self.records.append({
                "RecordId": "12345", "RR": params["RR"], "Type": params["Type"],
                "Value": params["Value"], "Status": "Enable",
            })
            return {"RecordId": "12345"}
        if action == "DeleteDomainRecord":
            self.deleted.append(params["RecordId"])
            self.records = [r for r in self.records if r["RecordId"] != params["RecordId"]]
            return {"RecordId": params["RecordId"]}
        if action == "DescribeDomainCertificateInfo":
            return {"CertInfos": {"CertInfo": [self.remote] if self.remote else []}}
        if action == "SetCdnDomainSSLCertificate":
            if self.upload_error:
                raise self.upload_error
            self.uploads.append(params)
            self.remote = {"ServerCertificate": params["SSLPub"],
                           "ServerCertificateStatus": "on", "DomainName": DOMAIN}
            return {"RequestId": "fake-request"}
        raise AssertionError(f"Unexpected API action: {action}")


def record(record_id="existing", value=VALUE, rr="_acme-challenge.img", kind="TXT"):
    return {"RecordId": record_id, "Value": value, "RR": rr, "Type": kind, "Status": "Enable"}


def certificate_bundle(domain=DOMAIN, days=60, issuer_name="Offline Test Root"):
    now = datetime.now(timezone.utc)
    root_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    root_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, issuer_name)])
    root = (
        x509.CertificateBuilder().subject_name(root_name).issuer_name(root_name)
        .public_key(root_key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=2)).not_valid_after(now + timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=True, path_length=1), critical=True)
        .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(root_key.public_key()), critical=False)
        .sign(root_key, hashes.SHA256())
    )
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, domain)]))
        .issuer_name(root_name).public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1)).not_valid_after(now + timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(domain)]), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.KeyUsage(True, False, True, False, False, False, False, False, False), critical=True)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(root_key.public_key()), critical=False)
        .sign(root_key, hashes.SHA256())
    )
    return (
        leaf.public_bytes(serialization.Encoding.PEM),
        key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                          serialization.NoEncryption()),
        root,
    )


class DnsHooksTests(unittest.TestCase):
    def test_other_domain_cannot_write_dns(self):
        api = FakeCloud()
        with self.assertRaises(hooks.HookError):
            hooks.authenticate(api, lambda *_: None, "demo.qqsylveon.love", VALUE)
        self.assertEqual(api.calls, [])

    def test_creates_challenge_and_cleanup_preserves_unrelated_records(self):
        api = FakeCloud([record("old", "old-value"), record("www", "1.2.3.4", "www", "A")])
        ready = []
        marker = hooks.authenticate(api, lambda *args: ready.append(args), DOMAIN, VALUE)
        self.assertEqual(ready, [("_acme-challenge.img.qqsylveon.love", VALUE)])
        self.assertTrue(marker["owned"])
        hooks.cleanup(api, marker, DOMAIN, VALUE)
        self.assertEqual(api.deleted, ["12345"])
        self.assertEqual([r["RecordId"] for r in api.records], ["old", "www"])
        hooks.cleanup(api, marker, DOMAIN, VALUE)
        self.assertEqual(api.deleted, ["12345"])

    def test_reused_record_is_not_deleted(self):
        api = FakeCloud([record()])
        marker = hooks.authenticate(api, lambda *_: None, DOMAIN, VALUE)
        self.assertFalse(marker["owned"])
        hooks.cleanup(api, marker, DOMAIN, VALUE)
        self.assertEqual(api.deleted, [])
        self.assertEqual(len(api.records), 1)

    def test_validation_failure_removes_only_our_record(self):
        api = FakeCloud([record("old", "different")])
        def timeout(*_):
            raise hooks.HookError("DNS propagation timed out")
        with self.assertRaises(hooks.HookError):
            hooks.authenticate(api, timeout, DOMAIN, VALUE)
        self.assertEqual(api.deleted, ["12345"])
        self.assertEqual([r["RecordId"] for r in api.records], ["old"])

    def test_cleanup_rejects_another_challenge_marker(self):
        api = FakeCloud([record("12345")])
        marker = {"owned": True, "record_id": "12345", "domain": DOMAIN,
                  "validation": "some-other-validation-value"}
        with self.assertRaises(hooks.HookError):
            hooks.cleanup(api, marker, DOMAIN, VALUE)
        self.assertEqual(api.deleted, [])

    def test_cleanup_refuses_to_delete_replaced_record(self):
        api = FakeCloud([record("12345", "a-different-value")])
        marker = {"owned": True, "record_id": "12345", "domain": DOMAIN, "validation": VALUE}
        hooks.cleanup(api, marker, DOMAIN, VALUE)
        self.assertEqual(api.deleted, [])

    def test_command_hooks_exchange_json_and_handle_certbot_510_environment(self):
        api = FakeCloud()
        output = io.StringIO()
        environment = {"CERTBOT_IDENTIFIER": DOMAIN, "CERTBOT_VALIDATION": VALUE}
        with patch.dict("os.environ", environment, clear=True):
            with patch.object(hooks, "AliyunApi", return_value=api):
                with patch.object(hooks, "wait_for_dns"), redirect_stdout(output):
                    self.assertEqual(hooks.main(["auth"]), 0)
                marker = json.loads(output.getvalue())
                self.assertTrue(marker["owned"])
                with patch.dict("os.environ", {"CERTBOT_AUTH_OUTPUT": output.getvalue()}):
                    self.assertEqual(hooks.main(["cleanup"]), 0)
        self.assertEqual(api.deleted, ["12345"])


class DnsPropagationTests(unittest.TestCase):
    def test_waits_until_every_authoritative_server_has_the_exact_txt(self):
        import dns.flags
        import dns.message
        import dns.rrset

        clock = [0]
        sleeps = []
        queries = []
        resolver = SimpleNamespace(resolve=lambda name, kind: (
            [SimpleNamespace(target="ns1.example."), SimpleNamespace(target="ns2.example.")]
            if kind == "NS" else ["192.0.2.1" if name.startswith("ns1") else "192.0.2.2"]
        ))

        def query(message, address, **_):
            queries.append(address)
            response = dns.message.make_response(message)
            response.flags |= dns.flags.AA
            value = "not-the-current-challenge" if len(queries) == 2 else VALUE
            response.answer.append(dns.rrset.from_text(hooks.TXT_NAME, 600, "IN", "TXT", f'"{value}"'))
            return response

        def sleep(seconds):
            sleeps.append(seconds)
            clock[0] += seconds

        with patch("dns.resolver.Resolver", return_value=resolver):
            with patch("dns.query.udp", side_effect=query):
                with patch.object(hooks.time, "monotonic", side_effect=lambda: clock[0]):
                    with patch.object(hooks.time, "sleep", side_effect=sleep):
                        hooks.wait_for_dns(hooks.TXT_NAME, VALUE)
        self.assertEqual(queries, ["192.0.2.1", "192.0.2.2", "192.0.2.1", "192.0.2.2"])
        self.assertEqual(sleeps, [10, 120])


class CertificateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pem, cls.key, cls.root = certificate_bundle()

    def test_trusted_matching_certificate_normalizes_private_key(self):
        bundle = hooks.validate_bundle(self.pem, self.key, [self.root])
        self.assertEqual(bundle.certificate, self.pem.decode())
        self.assertIn("BEGIN RSA PRIVATE KEY", bundle.private_key)
        self.assertEqual(len(bundle.fingerprint), 64)

    def test_wrong_hostname_is_rejected(self):
        pem, key, root = certificate_bundle("demo.qqsylveon.love")
        with self.assertRaises(hooks.HookError):
            hooks.validate_bundle(pem, key, [root])

    def test_mismatched_key_is_rejected(self):
        _, key, _ = certificate_bundle()
        with self.assertRaises(hooks.HookError):
            hooks.validate_bundle(self.pem, key, [self.root])

    def test_untrusted_staging_chain_is_rejected(self):
        pem, key, _ = certificate_bundle(issuer_name="(STAGING) Example CA")
        with self.assertRaises(hooks.HookError):
            hooks.validate_bundle(pem, key, [self.root])

    def test_expired_certificate_is_rejected(self):
        pem, key, root = certificate_bundle(days=-0.1)
        with self.assertRaises(hooks.HookError):
            hooks.validate_bundle(pem, key, [root])


class SdkTransportTests(unittest.TestCase):
    def test_sdk_debug_cannot_log_temporary_credentials(self):
        import requests
        from alibabacloud_credentials.client import Client as Credentials
        from alibabacloud_credentials.models import Config

        token = "offline-sensitive-session-token"
        credential = Credentials(Config(
            type="sts", access_key_id="offline-test-id",
            access_key_secret="offline-test-secret", security_token=token,
        ))
        output = io.StringIO()
        handler = logging.StreamHandler(output)
        logger = logging.getLogger("darabonba-core")
        logger.addHandler(handler)

        def transport(request, **_):
            response = requests.Response()
            response.status_code = 200
            response.headers["Content-Type"] = "application/json"
            response.raw = io.BytesIO(b'{"RequestId":"offline-test"}')
            response.request = request
            return response

        try:
            with patch.dict("os.environ", {"DEBUG": "sdk"}):
                with patch("requests.Session.send", side_effect=transport):
                    with redirect_stderr(output), redirect_stdout(output):
                        api = hooks.AliyunApi(credential)
                        result = api.call("cdn", "DescribeDomainCertificateInfo", DomainName=DOMAIN)
            self.assertEqual(result["RequestId"], "offline-test")
            self.assertNotIn(token, output.getvalue())
        finally:
            logger.removeHandler(handler)

    def test_real_sdk_sends_private_key_in_https_post_body_only(self):
        from alibabacloud_credentials.client import Client as Credentials
        from alibabacloud_credentials.models import Config

        credential = Credentials(Config(
            type="access_key", access_key_id="offline-test-id",
            access_key_secret="offline-test-secret",
        ))
        api = hooks.AliyunApi(credential)
        captured = []

        def transport(request, *_):
            captured.append(request)
            return SimpleNamespace(status_code=200, headers={},
                                   body=io.BytesIO(b'{"RequestId":"offline-test"}'))

        with patch("alibabacloud_tea_openapi.client.DaraCore.do_action", side_effect=transport):
            response = api.call(
                "cdn", "SetCdnDomainSSLCertificate", DomainName=DOMAIN,
                SSLProtocol="on", CertType="upload",
                SSLPub="test-certificate", SSLPri="test-private-key",
            )
        self.assertEqual(response["RequestId"], "offline-test")
        self.assertEqual(len(captured), 1)
        request = captured[0]
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.protocol, "HTTPS")
        self.assertNotIn("SSLPri", request.query)
        self.assertEqual(parse_qs(request.body)["SSLPri"], ["test-private-key"])

    def test_production_defaults_to_imdsv2_instance_role(self):
        with patch("alibabacloud_credentials.client.Client") as credentials:
            hooks.AliyunApi()
        config = credentials.call_args.args[0]
        self.assertEqual(config.type, "ecs_ram_role")
        self.assertTrue(config.disable_imds_v1)
        self.assertIsNone(config.access_key_id)
        self.assertIsNone(config.access_key_secret)

    def test_sdk_request_error_is_redacted(self):
        from alibabacloud_credentials.client import Client as Credentials
        from alibabacloud_credentials.models import Config

        api = hooks.AliyunApi(Credentials(Config(
            type="access_key", access_key_id="offline-test-id",
            access_key_secret="offline-test-secret",
        )))
        with patch("alibabacloud_tea_openapi.client.DaraCore.do_action",
                   side_effect=ValueError("SSLPri=private-key-must-not-appear")):
            with self.assertRaises(hooks.HookError) as caught:
                api.call("cdn", "SetCdnDomainSSLCertificate", SSLPri="private-key")
        self.assertNotIn("private-key", str(caught.exception))


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.pem, self.key, self.root = certificate_bundle()
        self.bundle = hooks.validate_bundle(self.pem, self.key, [self.root])

    def test_uploads_then_skips_identical_remote_certificate(self):
        api = FakeCloud()
        self.assertEqual(hooks.synchronize(api, self.bundle), "updated")
        self.assertEqual(hooks.synchronize(api, self.bundle), "unchanged")
        self.assertEqual(len(api.uploads), 1)
        self.assertEqual(api.uploads[0]["DomainName"], DOMAIN)
        self.assertEqual(api.uploads[0]["SSLProtocol"], "on")
        self.assertEqual(api.uploads[0]["CertType"], "upload")

    def test_upload_failure_can_be_retried_without_another_renewal(self):
        api = FakeCloud(upload_error=hooks.HookError("CDN unavailable"))
        with self.assertRaises(hooks.HookError):
            hooks.synchronize(api, self.bundle)
        api.upload_error = None
        self.assertEqual(hooks.synchronize(api, self.bundle), "updated")

    def test_does_not_replace_newer_remote_certificate(self):
        newer, _, _ = certificate_bundle(days=120)
        api = FakeCloud(remote={"ServerCertificate": newer.decode(),
                                "ServerCertificateStatus": "on", "DomainName": DOMAIN})
        with self.assertRaises(hooks.HookError):
            hooks.synchronize(api, self.bundle)
        self.assertEqual(api.uploads, [])

    def test_disabled_https_is_reenabled_even_for_same_certificate(self):
        api = FakeCloud(remote={"ServerCertificate": self.pem.decode(),
                                "ServerCertificateStatus": "off", "DomainName": DOMAIN})
        self.assertEqual(hooks.synchronize(api, self.bundle), "updated")

    def test_demo_deploy_hook_is_skipped_before_any_cloud_access(self):
        with patch.dict("os.environ", {"RENEWED_DOMAINS": "demo.qqsylveon.love"}, clear=True):
            with patch.object(hooks, "AliyunApi", side_effect=AssertionError("Must not create client")):
                self.assertEqual(hooks.main(["sync"]), 0)

    def test_sdk_exception_never_prints_private_request(self):
        private = "PRIVATE-KEY-AND-ACCESSKEY-MUST-NOT-APPEAR"
        output = io.StringIO()
        with patch.object(hooks, "AliyunApi", side_effect=RuntimeError(private)):
            with redirect_stderr(output):
                self.assertEqual(hooks.main(["check"]), 1)
        self.assertNotIn(private, output.getvalue())
        self.assertIn("failed", output.getvalue().lower())

    def test_loads_actual_lineage_files(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            (path / "fullchain.pem").write_bytes(self.pem)
            (path / "privkey.pem").write_bytes(self.key)
            with patch.object(hooks, "system_roots", return_value=[self.root]):
                bundle = hooks.load_bundle(path)
        self.assertEqual(bundle.fingerprint, self.bundle.fingerprint)

    def test_sync_rejects_untrusted_files_before_cloud_client_is_created(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            (path / "fullchain.pem").write_bytes(self.pem)
            (path / "privkey.pem").write_bytes(self.key)
            output = io.StringIO()
            with patch.dict("os.environ", {"RENEWED_DOMAINS": DOMAIN,
                                          "RENEWED_LINEAGE": str(path)}, clear=True):
                with patch.object(hooks, "system_roots", return_value=[]):
                    with patch.object(hooks, "AliyunApi") as client, redirect_stderr(output), \
                            patch.object(hooks, "deployment_lock", return_value=nullcontext()):
                        self.assertEqual(hooks.main(["sync"]), 1)
            client.assert_not_called()

    def test_sync_acquires_lock_before_reading_certificate_files(self):
        from contextlib import contextmanager
        state = {"locked": False}

        @contextmanager
        def lock(*_):
            state["locked"] = True
            try:
                yield
            finally:
                state["locked"] = False

        def load(*_):
            self.assertTrue(state["locked"])
            return self.bundle

        with patch.dict("os.environ", {}, clear=True):
            with patch.object(hooks, "deployment_lock", side_effect=lock, create=True):
                with patch.object(hooks, "load_bundle", side_effect=load):
                    with patch.object(hooks, "AliyunApi", return_value=FakeCloud()):
                        self.assertEqual(hooks.main(["sync"]), 0)
        self.assertFalse(state["locked"])


class DeploymentLockTests(unittest.TestCase):
    def test_another_process_cannot_deploy_until_lock_is_released(self):
        code = (
            "import importlib.util,sys; from pathlib import Path; "
            "spec=importlib.util.spec_from_file_location('hooks',sys.argv[1]); "
            "module=importlib.util.module_from_spec(spec);sys.modules['hooks']=module;"
            "spec.loader.exec_module(module);"
            "lock=module.deployment_lock(Path(sys.argv[2]));"
            "lock.__enter__();lock.__exit__(None,None,None)"
        )
        with tempfile.TemporaryDirectory() as temp:
            lock_file = Path(temp) / "deployment.lock"
            args = [sys.executable, "-c", code, str(ROOT / "deploy/certbot/aliyun_certificate.py"),
                    str(lock_file)]
            # The production path is passed explicitly so no test writes outside its temp directory.
            with hooks.deployment_lock(lock_file):
                blocked = subprocess.run(args, capture_output=True, timeout=15)
                self.assertNotEqual(blocked.returncode, 0)
            allowed = subprocess.run(args, capture_output=True, timeout=15)
            self.assertEqual(allowed.returncode, 0, allowed.stderr.decode())


if __name__ == "__main__":
    unittest.main()
