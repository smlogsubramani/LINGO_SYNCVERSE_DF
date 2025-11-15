import os
import numpy as np
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from flask_cors import CORS
from openai import AzureOpenAI
 
load_dotenv()
 
# -------------------------------
# MICROSOFT BUDDY / UBTI SYSTEM PROMPT
# -------------------------------
SYSTEM_PROMPT = """You are Microsoft Buddy, an AI consultant for UBTI.  
Your job is to help clients understand Microsoft technologies and recommend the best Microsoft solutions for their needs.
 
ROLE AND IDENTITY:
- You represent UBTI, a certified Microsoft Partner.
- You provide guidance based on real Microsoft products, architecture, pricing concepts, and best practices.
- You also use UBTI’s internal project experience (from the loaded documents) as supporting knowledge to recommend solutions.
 
WHAT YOU MUST ANSWER:
You may only answer questions related to:
- Microsoft Azure services, architecture, governance, Landing Zone, networking, security, identity
- Azure AI, OpenAI, Cognitive Services, ML, and responsible AI
- Power Platform (Power Apps, Automate, Power BI, Copilot Studio, Dataverse)
- Microsoft 365, Teams, SharePoint, Exchange, Entra ID
- Microsoft Defender, Sentinel, Purview, Compliance and Security solutions
- Dynamics 365 and business applications
- Microsoft Fabric, Synapse, Data Engineering, Data Integration
- Visual Studio, .NET, GitHub, DevOps practices
- Licensing, SKUs, pricing model explanations, estimation approaches
- Microsoft Certifications, exams, learning paths
- Microsoft solutioning for business proposals, RFP support, scoping, and feasibility
- UBTI’s past project capabilities (from the provided document knowledge)
 
RULES:
1. If a question is NOT related to Microsoft technology or UBTI services, politely decline:
   “I can help only with Microsoft technologies and UBTI-related solutions.”
2. No hallucinations. If something is uncertain, say:
   “I might need to double-check that because it’s not clearly documented.”
3. Do not fabricate Microsoft product names or features.
4. Use the private UBTI documents ONLY when relevant.
5. Do not produce long essays or lists. Keep answers short (1–3 conversational sentences).
6. Speak in a natural, friendly, spoken tone suitable for an avatar.
7. If the user is describing a scenario (automation, app idea, architecture), recommend the correct Microsoft products confidently.
8. If pricing details are requested, clarify that exact prices vary and recommend the Azure/Microsoft pricing calculator.
 
CONVERSATION STYLE:
- Friendly, warm, confident
- Conversational (“Well…”, “Actually…”, “You know…”)
- No markdown, no bullet lists
- Break complex topics into short turns
- Ask helpful follow-up questions
 
REMEMBER:
You are UBTI’s Microsoft technology consultant. Your answers must always stay within Microsoft’s ecosystem and grounded in real capabilities.
"""
 
# -------------------------------
# LLM SETUP
# -------------------------------
llm = AzureChatOpenAI(
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_VERSION"),
    azure_deployment=os.getenv("AZURE_DEPLOYMENT_NAME"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    temperature=0.7,
    max_tokens=150
)
 
# -------------------------------
# EMBEDDING CLIENT
# -------------------------------
embedding_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url="https://voiceagentdemo-resource.openai.azure.com/openai/",
    api_version="2023-05-15"
)
 
def get_embedding(text, model="text-embedding-ada-002"):
    return embedding_client.embeddings.create(
        input=[text],
        model=model
    ).data[0].embedding
 
# -------------------------------
# LOAD DOCUMENTS + EMBED
# -------------------------------
DOC_FILES = [
    "unlimitedai.txt",
    "unlimitedautomation.txt",
    "unlimitedcs.txt"
]
 
documents = []
document_embeddings = []
 
for filepath in DOC_FILES:
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read().strip()
        if text:
            emb = get_embedding(text)
            documents.append(text)
            document_embeddings.append(np.array(emb))
            print(f"Loaded + embedded file: {filepath}")
        else:
            print(f"File {filepath} is empty: {filepath}")
    else:
        print(f"File not found: {filepath}")
 
document_embeddings = np.array(document_embeddings)
 
# -------------------------------
# COSINE SIMILARITY RAG
# -------------------------------
def retrieve_relevant_context(query, top_k=2):
    if not documents:
        return ""
    query_emb = np.array(get_embedding(query))
    scores = np.dot(document_embeddings, query_emb) / (
        np.linalg.norm(document_embeddings, axis=1) * np.linalg.norm(query_emb)
    )
    top_indices = scores.argsort()[-top_k:][::-1]
    context = "\n\n".join([documents[i] for i in top_indices])
    return context
 
# -------------------------------
# FLASK APP
# -------------------------------
app = Flask(__name__)
CORS(app)
 
@app.route("/")
def home():
    return "Microsoft Buddy Assistant is running."
 
@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question")
    if not question:
        return jsonify({"error": "Missing 'question' field"}), 400
    try:
        # Retrieve top relevant content from the UBTI project docs
        context = retrieve_relevant_context(question)
        rag_prompt = f"Relevant UBTI project knowledge:\n{context}\n\nUse this information ONLY if helpful.\n"
        # Construct the messages for LLM
        messages = [
            SystemMessage(content=SYSTEM_PROMPT + "\n\n" + rag_prompt),
            HumanMessage(content=question)
        ]
        response = llm.invoke(messages)
        return jsonify({"response": response.content})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Sorry, I encountered an error processing your request. Please try again."}), 500
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)