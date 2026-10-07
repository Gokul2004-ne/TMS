import urllib.request

js = urllib.request.urlopen('https://krishna-caare.github.io/novaarc-rcm/assets/index-Bmoxqgyi.js').read().decode('utf-8')
idx = js.find('const Db=[')
if idx == -1:
    idx = js.find('Db=[')
print(js[idx:idx+800])
