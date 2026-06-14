const fs = require('fs');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { v4: uuidv4 } = require('uuid');
const KnowledgeBase = require('../models/KnowledgeBase');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
});

// Initialize Pinecone
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'mock-pinecone-key'
});
const pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME || 'mock-index');

// Helper to chunk text
const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));
    startIndex += chunkSize - overlap;
  }
  return chunks;
};

// Generate embedding using OpenAI
const generateEmbedding = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.warn('OpenAI Embedding Error (Likely invalid API Key). Returning mock embedding vector.');
    return new Array(1536).fill(0.001); // Return dummy vector
  }
};

// Process PDF and store chunks
const processAndStorePDF = async (filePath, documentId) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    const chunks = chunkText(pdfData.text);
    
    const vectors = [];
    for (const chunk of chunks) {
      if (chunk.trim() === '') continue;
      
      const embedding = await generateEmbedding(chunk);
      
      vectors.push({
        id: uuidv4(),
        values: embedding,
        metadata: {
          text: chunk,
          documentId: documentId.toString()
        }
      });
    }
    
    if (vectors.length > 0) {
      await pineconeIndex.upsert(vectors);
    }
    
    // Update doc status
    await KnowledgeBase.findByIdAndUpdate(documentId, { status: 'active' });
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    await KnowledgeBase.findByIdAndUpdate(documentId, { status: 'failed' });
    throw error;
  }
};

// Query Vector DB
const retrieveContext = async (queryText) => {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    
    const queryResponse = await pineconeIndex.query({
      topK: 5,
      vector: queryEmbedding,
      includeMetadata: true
    });
    
    if (!queryResponse.matches) return "";
    
    return queryResponse.matches.map(match => match.metadata.text).join('\n\n');
  } catch (error) {
    console.error('Pinecone vector search failed.', error);
    return ""; // Return empty context if index is not present or failed
  }
};

// Generate Chat Response
const generateChatResponse = async (messages, context, roleType) => {
  let systemPrompt = `You are an expert agriculture AI assistant. Use the provided context to answer questions. If the context does not contain the answer, use your general knowledge, but prioritize the context.`;
  
  if (roleType === 'farmer') {
    systemPrompt += `\nYou are talking to a Farmer. Focus on cultivation processes, crop recommendations, disease management, and yield improvement. When recommending crops, format them clearly as selectable options (e.g., bullet points). Use the provided RAG context to answer general agriculture questions.`;
  } else if (roleType === 'consumer') {
    systemPrompt += `\nYou are talking to a Consumer. You MUST ONLY recommend agricultural products (like tools, seeds, fertilizers available for purchase) or discuss product benefits. If they ask about crop diseases or how to grow crops, politely decline and state that you are exclusively for product recommendations.`;
  }

  systemPrompt += `\n\nCONTEXT:\n${context}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.warn('OpenAI Chat Error (Likely invalid API Key). Returning mock response.');
    
    // Check if the user is asking about recommendations to trigger the mock PDF logic
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    if (lastUserMessage.includes('recommend') || lastUserMessage.includes('crop') || lastUserMessage.includes('corn') || lastUserMessage.includes('wheat')) {
       return "Based on your request, I strongly recommend our optimal cultivation schedule for this crop. Would you like me to generate the full 6-month cultivation plan report?";
    }

    if (roleType === 'consumer') {
      return "Since I am currently running in a mock environment (Missing API Key), I'll just recommend our top product: **Drought-Resistant Maize Seeds** for $145.00. This is an excellent choice!";
    }

    return "I am currently running without a valid OpenAI API Key, so this is a simulated response. Please configure `OPENAI_API_KEY` in the `.env` file to enable real intelligence.";
  }
};

// PDF generation text for Farmer's crop recommendation
const generateCropRecommendationPDF = async (cropDetails) => {
  const prompt = `Generate a 6-month comprehensive cultivation process report for ${cropDetails}. Include land preparation, sowing, irrigation, fertilizer schedule, disease management, and harvesting. Format it cleanly.`;
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content;
  } catch (error) {
    return `[MOCK PDF REPORT]\n\nCultivation Process for ${cropDetails}\n\n1. Land Preparation: Plow the field 2-3 times.\n2. Sowing: Plant seeds at a depth of 5cm.\n3. Irrigation: Water every 3-4 days.\n4. Harvesting: Harvest after 120 days.\n\nNote: Set OPENAI_API_KEY for real generated reports.`;
  }
};


module.exports = {
  processAndStorePDF,
  retrieveContext,
  generateChatResponse,
  generateCropRecommendationPDF
};
