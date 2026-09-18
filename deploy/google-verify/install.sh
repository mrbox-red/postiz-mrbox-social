#!/bin/bash
# Viral Starz: pubblica il file di verifica Google Search Console su social.meridianeagency.com
# Uso (dal Mac): bash ~/Documents/mrbox/postiz/deploy/google-verify/install.sh
TOKEN=googlea07cc1810244d276.html
ssh -o ConnectTimeout=10 root@2.28.97.15 "set -e
F=/etc/nginx/sites-available/social.meridianeagency.com
cp \$F \$F.bak-\$(date +%Y%m%d-%H%M%S)
mkdir -p /var/www/viralstarz-verify
printf 'google-site-verification: $TOKEN' > /var/www/viralstarz-verify/$TOKEN
grep -q viralstarz-verify \$F || sed -i 's|    location /legal/ {|    location = /$TOKEN {\n        root /var/www/viralstarz-verify;\n    }\n\n    location /legal/ {|' \$F
nginx -t && systemctl reload nginx && echo RELOADED"
echo "--- verifica esterna:"; curl -s "https://social.meridianeagency.com/$TOKEN"; echo
curl -s -o /dev/null -w 'legal=%{http_code}\n' https://social.meridianeagency.com/legal/privacy
