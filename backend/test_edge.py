import asyncio
import edge_tts
async def main():
    communicate = edge_tts.Communicate("Hello world", "en-IN-NeerjaNeural")
    await communicate.save("test_out.mp3")
asyncio.run(main())
