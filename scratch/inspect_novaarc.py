import urllib.request
import re

req = urllib.request.Request('https://krishna-caare.github.io/novaarc-rcm/assets/index-Bmoxqgyi.js', headers={'User-Agent': 'Mozilla/5.0'})
jdata = urllib.request.urlopen(req).read().decode('utf-8')

routes = re.findall(r'path:\s*["\']([^"\']+)["\']', jdata)
print("Routes:", routes)

# search for login/dashboard navigation
navs = re.findall(r'["\'](/[^"\']+)["\']', jdata)
endpoints = [n for n in set(navs) if any(k in n for k in ['login', 'dashboard', 'claims', 'overview', 'work'])]
print("Endpoints:", endpoints[:20])
