from engine.agent import get_llm
from langchain_core.messages import HumanMessage
try:
    llm = get_llm()
    resp = llm.invoke([HumanMessage(content="hello")])
    print("Success:", resp.content)
except Exception as e:
    print("Error:", str(e))
