import requests
r = requests.get('http://127.0.0.1:8000/api/tts?text=hello&language=en')
print("Status:", r.status_code)
