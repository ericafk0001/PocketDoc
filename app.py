import tensorflow as tf
import numpy as np
from flask import Flask, request, jsonify, Response, stream_with_context
from werkzeug.utils import secure_filename
import os
from io import BytesIO
from PIL import Image
import base64
import requests
import json
from dotenv import load_dotenv

load_dotenv()

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    print("✅ HEIC/HEIF support enabled")
except ImportError:
    # Keep app startup working even if optional dependency is missing.
    print("⚠️ HEIC/HEIF support unavailable (install pillow-heif)")

# ── Configuration ─────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder='app', static_url_path='')

MODEL_PATH = "./wound_classifier.keras"
IMG_SIZE = (224, 224)
CLASS_NAMES = [
    "Abrasions", "Bruises", "Burns", "Cut",
    "Laceration", "Ingrown Nails", "Stab Wounds"
]

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}
HACK_CLUB_AI_BASE_URL = "https://ai.hackclub.com/proxy/v1/chat/completions"
DEFAULT_CHAT_MODEL = os.getenv("HACK_CLUB_AI_MODEL", "qwen/qwen3-32b")

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# ── Load Model ────────────────────────────────────────────────────────────────

model = tf.keras.models.load_model(MODEL_PATH)
print("✅ Model loaded successfully\n")

# Build an output-size-aligned class list to avoid index errors when model
# output units and hardcoded labels differ.
MODEL_OUTPUT_CLASSES = int(model.output_shape[-1])
if MODEL_OUTPUT_CLASSES <= len(CLASS_NAMES):
    ACTIVE_CLASS_NAMES = CLASS_NAMES[:MODEL_OUTPUT_CLASSES]
else:
    extra = [f"Class_{i}" for i in range(len(CLASS_NAMES), MODEL_OUTPUT_CLASSES)]
    ACTIVE_CLASS_NAMES = CLASS_NAMES + extra

if MODEL_OUTPUT_CLASSES != len(CLASS_NAMES):
    print(
        f"⚠️ Class label mismatch: model outputs {MODEL_OUTPUT_CLASSES}, "
        f"configured labels {len(CLASS_NAMES)}. Using {len(ACTIVE_CLASS_NAMES)} labels."
    )

# ── Helper Functions ──────────────────────────────────────────────────────────

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def prepare_image(img):
    """Prepare image for model prediction."""
    img = img.resize(IMG_SIZE)
    img_array = tf.keras.utils.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def predict_image(img_array):
    """Run inference and return prediction."""
    predictions = model.predict(img_array, verbose=0)
    predicted_index = int(np.argmax(predictions[0]))
    predicted_class = ACTIVE_CLASS_NAMES[predicted_index]
    confidence = np.max(predictions) * 100
    
    # Get all predictions
    all_predictions = {
        ACTIVE_CLASS_NAMES[i]: float(predictions[0][i] * 100)
        for i in range(len(ACTIVE_CLASS_NAMES))
    }
    
    return {
        "class": predicted_class,
        "confidence": float(confidence),
        "all_predictions": all_predictions
    }

def build_ai_system_prompt():
    """System prompt used for PocketDoc AI chat."""
    return (
        "You are PocketDoc AI, a wound-care helper. Give calm, practical first-aid guidance "
        "for minor wounds and include safety warnings. Do not diagnose with certainty. "
        "If there are emergency red flags (severe bleeding, breathing trouble, chest pain, "
        "fainting, deep wounds, spreading redness with fever), advise urgent in-person care."
    )

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    """Serve the main app."""
    return app.send_static_file('index.html')

@app.route('/predict/upload', methods=['POST'])
def predict_upload():
    """Handle image upload and prediction."""
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400
        
        # Open the image
        img = Image.open(file.stream).convert('RGB')
        
        # Prepare and predict
        img_array = prepare_image(img)
        result = predict_image(img_array)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/predict/camera', methods=['POST'])
def predict_camera():
    """Handle base64 encoded image from camera and prediction."""
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({"error": "No image data provided"}), 400
        
        # Decode base64 image
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        
        # Prepare and predict
        img_array = prepare_image(img)
        result = predict_image(img_array)
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Proxy chat requests to Hack Club AI and return assistant text."""
    try:
        payload = request.get_json(silent=True) or {}
        messages = payload.get("messages", [])

        if not isinstance(messages, list) or len(messages) == 0:
            return jsonify({"error": "Messages are required"}), 400

        api_key = os.getenv("HACK_CLUB_AI_API_KEY")
        if not api_key:
            return jsonify({
                "error": "Server missing HACK_CLUB_AI_API_KEY. Set it in your environment."
            }), 500

        upstream_payload = {
            "model": DEFAULT_CHAT_MODEL,
            "messages": [
                {"role": "system", "content": build_ai_system_prompt()},
                *messages,
            ],
            "stream": False,
            "temperature": 0.5,
        }

        upstream_response = requests.post(
            HACK_CLUB_AI_BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=upstream_payload,
            timeout=45,
        )

        if upstream_response.status_code >= 400:
            return jsonify({
                "error": "AI service error",
                "details": upstream_response.text,
            }), 502

        upstream_json = upstream_response.json()
        content = (
            upstream_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        if not content:
            return jsonify({"error": "AI returned an empty response"}), 502

        return jsonify({"reply": content}), 200

    except requests.RequestException as e:
        return jsonify({"error": f"Failed to reach AI service: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ai/chat/stream', methods=['POST'])
def ai_chat_stream():
    """Stream assistant response chunks via SSE."""
    payload = request.get_json(silent=True) or {}
    messages = payload.get("messages", [])

    if not isinstance(messages, list) or len(messages) == 0:
        return jsonify({"error": "Messages are required"}), 400

    api_key = os.getenv("HACK_CLUB_AI_API_KEY")
    if not api_key:
        return jsonify({
            "error": "Server missing HACK_CLUB_AI_API_KEY. Set it in your environment."
        }), 500

    upstream_payload = {
        "model": DEFAULT_CHAT_MODEL,
        "messages": [
            {"role": "system", "content": build_ai_system_prompt()},
            *messages,
        ],
        "stream": True,
        "temperature": 0.5,
    }

    @stream_with_context
    def generate():
        try:
            with requests.post(
                HACK_CLUB_AI_BASE_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=upstream_payload,
                stream=True,
                timeout=(10, 120),
            ) as upstream_response:
                if upstream_response.status_code >= 400:
                    details = upstream_response.text
                    yield f"data: {json.dumps({'error': 'AI service error', 'details': details})}\n\n"
                    return

                for raw_line in upstream_response.iter_lines(decode_unicode=False):
                    if not raw_line:
                        continue
                    try:
                        line = raw_line.decode("utf-8")
                    except UnicodeDecodeError:
                        line = raw_line.decode("utf-8", errors="replace")
                    if not line.startswith("data: "):
                        continue

                    raw_data = line[6:]
                    if raw_data == "[DONE]":
                        yield "data: {\"done\": true}\n\n"
                        break

                    try:
                        chunk = json.loads(raw_data)
                    except json.JSONDecodeError:
                        continue

                    delta = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )

                    if delta:
                        yield f"data: {json.dumps({'delta': delta})}\n\n"
        except requests.RequestException as e:
            yield f"data: {json.dumps({'error': f'Failed to reach AI service: {str(e)}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )

# ── Error Handlers ────────────────────────────────────────────────────────────

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error."""
    return jsonify({"error": "File too large. Maximum size is 16MB"}), 413

if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)
