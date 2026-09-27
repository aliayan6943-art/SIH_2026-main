from engine.bhashini import BhashiniClient
c = BhashiniClient()
b = c.text_to_speech("hello world", "en")
print(len(b) if b else "Empty")
