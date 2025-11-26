const fs = require('fs/promises');


const { ClarifaiStub, grpc } = require('clarifai-nodejs-grpc');

const stub = ClarifaiStub.grpc();


const CLARIFAI_API_KEY = process.env.CLARIFAI_API_KEY;


const CLARIFAI_USER_ID = process.env.CLARIFAI_USER_ID || "clarifai";

const CLARIFAI_APP_ID = process.env.CLARIFAI_APP_ID || "main"; 



const metadata = new grpc.Metadata();
metadata.set("authorization", "Key " + CLARIFAI_API_KEY);


const MODEL_ID = "food-item-v1-recognition"; 


exports.analyzeImageForIngredients = async (imagePath) => {
    if (!CLARIFAI_API_KEY) {
        throw new Error("CLARIFAI_API_KEY is not set in environment variables.");
    }
    if (!CLARIFAI_USER_ID || !CLARIFAI_APP_ID) {
         throw new Error("Clarifai User ID or App ID is missing from environment configuration.");
    }

    try {
        
        const imageBuffer = await fs.readFile(imagePath);
        const imageBase64 = imageBuffer.toString("base64");

       
        const request = {
            
            user_app_id: {
                user_id: CLARIFAI_USER_ID,
                app_id: CLARIFAI_APP_ID,
            },
            model_id: MODEL_ID,
            inputs: [
                {
                    data: {
                        image: {
                            base64: imageBase64
                        }
                    }
                }
            ]
        };

        
        const response = await new Promise((resolve, reject) => {
            stub.PostModelOutputs(
                request,
                metadata,
                (err, res) => {
                    if (err) {
                        return reject(new Error("Clarifai API connection failed: " + err.details));
                    }
                    if (res.status.code !== 10000) {
                        
                        return reject(new Error(`Clarifai prediction failed: ${res.status.description}`));
                    }
                    resolve(res);
                }
            );
        });

       
        const outputs = response.outputs[0]?.data?.concepts || [];
        
        const recognizedIngredients = outputs
            .filter(concept => concept.value >= 0.65) 
            .map(concept => concept.name.toLowerCase());
        
        return recognizedIngredients;

    } catch (error) {
        console.error("Error calling Clarifai API:", error.message);
        throw new Error(`AI recognition failed: ${error.message}`);
    }
};