# 图片 CDN 证书自动续期

适用环境：Ubuntu 22.04、/snap/bin/certbot 5.10、阿里云 ECS。
固定域名：img.qqsylveon.love；DNS 必须实际托管在同账号阿里云云解析中。

这套配置保留已有 Snap Certbot、demo 证书和 Nginx。外部 Python 脚本使用 ECS 实例角色，不向 Snap 安装 DNS 插件，也不保存长期 AccessKey。

~~~text
Snap Certbot 定时检查
  → DNS 验证钩子添加 TXT，等待权威 DNS 生效
  → 签发证书，清理本次创建的 TXT
  → 部署钩子更新 CDN

额外的小时任务
  → 对比本地证书与 CDN，部署失败时重试
~~~

## 1. 为 ECS 绑定实例角色

1. 在阿里云 RAM 控制台创建角色，可信实体选择「阿里云服务」，服务选择 ECS。
2. 使用 deploy/certbot/ram-policy.json 创建自定义权限策略。把两处 YOUR_ALIYUN_ACCOUNT_ID 替换为自己的阿里云账号 UID。
3. 将策略授权给角色，再去 ECS 实例的「实例设置 → 授予/收回 RAM 角色」绑定它。
4. 如果实例已有角色（例如用于 OSS），在现有角色上追加本策略，保留原有权限。
5. 实例元数据应启用安全加固模式 IMDSv2。脚本禁止降级为 IMDSv1。

DNS 权限按整个 qqsylveon.love 域名授权；RAM 并不把权限缩小到某一条 TXT。脚本自身只允许操作 _acme-challenge.img，并且只清理本次创建且记录 ID、类型、内容仍匹配的记录。不要授予管理员权限或全量 CDN/DNS 权限。

## 2. 安装独立运行环境

将本仓库的 deploy/certbot 文件夹上传到服务器，例如 /root/photo-blog-certbot-source。
以下命令在 ECS 上执行，不是在 Windows 电脑上执行；你当前使用 root，可省略 sudo。

~~~bash
sudo apt-get update
sudo apt-get install -y python3-venv ca-certificates
sudo install -d -m 0700 /opt/photo-blog-certbot
sudo install -m 0600 /root/photo-blog-certbot-source/requirements.txt /opt/photo-blog-certbot/requirements.txt
sudo install -m 0700 /root/photo-blog-certbot-source/aliyun_certificate.py /opt/photo-blog-certbot/aliyun_certificate.py
sudo python3 -m venv /opt/photo-blog-certbot/venv
sudo /opt/photo-blog-certbot/venv/bin/python -m pip install -r /opt/photo-blog-certbot/requirements.txt
sudo /opt/photo-blog-certbot/venv/bin/python /opt/photo-blog-certbot/aliyun_certificate.py check
~~~

check 只验证 DNS 与 CDN 的读取权限，不创建记录或上传证书。成功读取不代表写权限也一定正确；下一步的续期演练会验证 DNS 写入和清理。

## 3. 把现有手动证书改为自动 DNS 验证

先确认 Certificate Name 是 img.qqsylveon.love：

~~~bash
sudo /snap/bin/certbot certificates
~~~

然后执行：

~~~bash
sudo /snap/bin/certbot reconfigure \
  --non-interactive \
  --cert-name img.qqsylveon.love \
  --manual-auth-hook "/opt/photo-blog-certbot/venv/bin/python /opt/photo-blog-certbot/aliyun_certificate.py auth" \
  --manual-cleanup-hook "/opt/photo-blog-certbot/venv/bin/python /opt/photo-blog-certbot/aliyun_certificate.py cleanup" \
  --deploy-hook "/opt/photo-blog-certbot/venv/bin/python /opt/photo-blog-certbot/aliyun_certificate.py sync"
~~~

Certbot 会先做一次测试续期，成功才保存新配置。DNS 传播需要几分钟，无需手动填写 TXT；旧的验证记录不会被批量删除。
保留 --non-interactive，不要加入 --run-deploy-hooks。这样本步骤不执行部署钩子；交互运行时若询问是否执行部署钩子，请选择不执行。脚本还会用系统信任根校验证书链、域名、有效期及私钥，拒绝把测试 CA 或自签名证书上传到 CDN。

如果实际 Certificate Name 有 -0001 等后缀，请把本节命令中的名称替换成实际值。同步脚本默认目录及 systemd 单元的 ConditionPathExists 也要相应修改；部署钩子本身使用 Certbot 提供的 RENEWED_LINEAGE。

## 4. 同步当前正式证书，启用定时检查

这是第一次实际更新云端 CDN 的操作。先确认 img.qqsylveon.love 已经在 CDN 控制台添加成功。

~~~bash
sudo /opt/photo-blog-certbot/venv/bin/python /opt/photo-blog-certbot/aliyun_certificate.py sync
sudo systemctl enable --now snap.certbot.renew.timer
sudo install -m 0644 /root/photo-blog-certbot-source/photo-blog-cdn-certificate.service /etc/systemd/system/photo-blog-cdn-certificate.service
sudo install -m 0644 /root/photo-blog-certbot-source/photo-blog-cdn-certificate.timer /etc/systemd/system/photo-blog-cdn-certificate.timer
sudo systemctl daemon-reload
sudo systemctl enable --now photo-blog-cdn-certificate.timer
~~~

Snap 的原有任务负责续期，小时任务只负责同步和重试，不会每小时重新申请证书，也不操作 demo 的 Nginx 配置。
新证书只在确实不同于当前 CDN 证书时上传；如果 CDN 已有更新的证书，会拒绝覆盖并留下错误。
手动同步、部署钩子和小时任务共用 /var/lib/photo-blog-certbot/deployment.lock，避免并发上传造成旧证书覆盖新证书。提示 Another certificate sync is running 时，等待当前任务结束后重试即可。

## 5. 验收与排查

~~~bash
sudo /snap/bin/certbot renew --cert-name img.qqsylveon.love --dry-run --non-interactive
sudo systemctl start photo-blog-cdn-certificate.service
sudo systemctl list-timers --all '*certbot*' '*photo-blog-cdn-certificate*'
sudo journalctl -u photo-blog-cdn-certificate.service -n 30 --no-pager
~~~

演练续期和 CDN 正式部署分开进行。验证通过的标准是：DNS 测试续期成功、同步日志为 updated 或 unchanged、CDN 控制台显示正确证书及到期时间。
完成 CNAME 解析后，再检查浏览器访问图片 HTTPS 时实际呈现的证书；根路径出现 403 不一定是 TLS 失败，因为私有 Bucket 或 Referer 规则可能拒绝该资源请求。

- ECS role / SDKError：检查实例角色、IMDSv2、出站网络与 Python 依赖。
- Forbidden / NoPermission：检查自定义 RAM 策略里的账号 UID、域名与 Action。
- DNS propagation timed out：检查实际 DNS 服务商、权威 DNS 解析，以及 UDP/TCP 53 出站。
- Certificate validation failed：检查完整证书链、主机名、服务器时间、系统 CA、有效期及私钥。
- CDN already has a newer certificate：检查是否有其他部署流程或旧的本地证书，不要强制回退。
- API 提示域名 offline：先检查用量封顶或安全状态，脚本不会自动解除流量封停。

SDK 原始错误可能含请求内容，因此脚本只记录安全错误码，不输出证书私钥或原始异常；脚本进程内还会移除 DEBUG 环境变量并禁用 SDK 日志。持续失败仍需查看日志和配置通知；不能把「有定时任务」当作「一定续期成功」。

## 停用同步任务

~~~bash
sudo systemctl disable --now photo-blog-cdn-certificate.timer
~~~

这只停止新增的小时同步任务，不撤销已上传证书、不删除 DNS 或证书文件，也不关闭 Snap 原有续期。若要完全回退，还需把该证书的续期钩子恢复为修改前的配置；不要停止所有证书的续期任务。

## 本地离线验证

~~~bash
python3 -m venv .superpowers/certificate-test
.superpowers/certificate-test/bin/python -m pip install -r deploy/certbot/requirements.txt
.superpowers/certificate-test/bin/python -m unittest discover -s tests/ops -p 'test_*.py' -v
~~~

Windows 下将上述 Python 路径改为 .superpowers/certificate-test/Scripts/python.exe。离线测试会生成临时测试证书并模拟网络，不使用真实 AccessKey，不调用真实 DNS/CDN 写接口。离线通过不能替代目标 ECS 上的验收。

参考：[Certbot 验证钩子](https://eff-certbot.readthedocs.io/en/stable/using.html#pre-and-post-validation-hooks)、[ECS 实例角色凭证](https://help.aliyun.com/zh/sdk/developer-reference/v2-manage-python-access-credentials)、[DNS 添加记录](https://help.aliyun.com/zh/dns/api-alidns-2015-01-09-adddomainrecord)、[CDN 更新证书](https://help.aliyun.com/zh/cdn/developer-reference/api-cdn-2018-05-10-setcdndomainsslcertificate)。
