# 🏥 PocketDoc - Wound Classification Web App

A Flask-based web application for wound classification using a pre-trained deep learning model.

## Features

✅ **Camera Capture** - Take photos directly from your device's camera
✅ **Image Upload** - Upload existing wound photos
✅ **Real-time Prediction** - Get instant wound classification
✅ **Confidence Scores** - See confidence levels for all wound types
✅ **Mobile Friendly** - Responsive design works on phones and tablets

## Wound Classification Categories

- Abrasions
- Bruises
- Burns
- Cut
- Diabetic Wounds
- Laceration
- Normal
- Pressure Wounds

## Setup Instructions

### 1. Create Virtual Environment

```bash
# Navigate to project directory
cd C:\Users\meow888\Desktop\PocketDoc

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the Flask App

```bash
# Set Hack Club AI key for chat features (macOS/Linux)
export HACK_CLUB_AI_API_KEY="your_key_here"

python app.py
```

Windows (PowerShell):

```powershell
$env:HACK_CLUB_AI_API_KEY="your_key_here"
python app.py
```

Windows (Command Prompt):

```bat
set HACK_CLUB_AI_API_KEY=your_key_here
python app.py
```

The app will start on `http://localhost:5000`

### 4. Access the Web App

Open your browser and go to:

```
http://localhost:5000
```

## Usage

1. **Using Camera:**
   - Click the "📷 Camera" button
   - Allow camera access when prompted
   - Click "📸 Capture" to take a photo
   - The app automatically analyzes the image

2. **Using Upload:**
   - Click the "📁 Upload Image" button
   - Select an image file from your device
   - The app automatically analyzes the image

3. **View Results:**
   - See the primary classification and confidence score
   - View all predictions with confidence percentages

## Project Structure

```
PocketDoc/
├── app.py                           # Flask backend
├── predict.py                       # Prediction utilities
├── train.py                         # Model training script
├── wound_classifier.keras           # Pre-trained model
├── requirements.txt                 # Python dependencies
└── app/
    ├── index.html                   # Web interface
    ├── script.js                    # Frontend logic
    └── uploads/                     # Uploaded images (auto-created)
```

## API Endpoints

### GET `/`

Serves the main web app UI

### GET `/health`

Health check endpoint

```bash
curl http://localhost:5000/health
```

### POST `/predict/upload`

Upload and predict image

```bash
curl -X POST -F "file=@image.jpg" http://localhost:5000/predict/upload
```

**Response:**

```json
{
  "class": "Cut",
  "confidence": 92.5,
  "all_predictions": {
    "Abrasions": 5.2,
    "Bruises": 2.1,
    "Burns": 0.2,
    "Cut": 92.5,
    "Diabetic Wounds": 0.0,
    "Laceration": 0.0,
    "Normal": 0.0,
    "Pressure Wounds": 0.0
  }
}
```

### POST `/predict/camera`

Predict from base64 encoded camera image

```bash
curl -X POST http://localhost:5000/predict/camera \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,..."}'
```

**Response:** Same as `/predict/upload`

## Technical Details

- **Backend:** Flask web framework
- **Model:** TensorFlow/Keras (224x224 input, 8 classes)
- **Frontend:** Vanilla JavaScript with HTML5 Canvas & WebRTC
- **File Handling:** Supports PNG, JPG, JPEG, GIF, WebP, HEIC, HEIF
- **Max File Size:** 16MB

## Troubleshooting

### Camera not working

- Grant camera permissions to your browser
- Use HTTPS or localhost (some browsers require this)
- Refresh the page and try again

### Model loading error

- Ensure `wound_classifier.keras` is in the project root
- Check that TensorFlow is installed correctly

### Large file error

- Maximum file size is 16MB
- Try compressing the image

## License

See [LICENSE](LICENSE)