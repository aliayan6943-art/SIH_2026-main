import requests
import json

url = "http://localhost:8000/api/chat"
headers = {"Content-Type": "application/json"}
data = {
    "patient_id": "p456",
    "message": "I have a mild headache",
    "language": "en"
}

response = requests.post(url, headers=headers, json=data)
print("Response Status Code:", response.status_code)
print("Response JSON:", json.dumps(response.json(), indent=2))
