# PocketDoc

PocketDoc is a Flask web application for AI-based wound image classification.
It is designed as a fast triage and decision-support tool for accessibility-focused care workflows.

### Core feature demo
https://github.com/user-attachments/assets/cf1b69a4-c599-4f3b-b8a9-5da4047b30ec

## Overview

- Classifies wound images into 8 categories using a TensorFlow/Keras model.
- Supports both camera capture and standard file upload in the browser.
- Returns a predicted class, confidence score, and full per-class probabilities.
- Includes a post-diagnosis chat assistant for follow-up guidance.

## Wound Classes

- Abrasions
- Bruises
- Burns
- Cut
- Diabetic Wounds
- Laceration
- Normal
- Pressure Wounds

## Installation

### 1. Create a virtual environment

```bash
# From the project root
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Set environment variable and run

macOS/Linux:

```bash
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

Open http://localhost:5000

## API

- `GET /`: Main web interface
- `GET /health`: Health check
- `POST /predict/upload`: Multipart image upload inference
- `POST /predict/camera`: Base64 camera image inference

Example:

```bash
curl -X POST -F "file=@image.jpg" http://localhost:5000/predict/upload
```

## Technical Notes

- Backend: Flask
- Frontend: HTML + JavaScript (WebRTC/Canvas)
- Model input: 224x224 RGB
- Output: Softmax over 8 classes
- Max upload size: 16 MB

## Future Additions

- Grad-CAM or saliency heatmaps for model interpretability.
- Segmentation-assisted wound boundary detection and size tracking.
- Longitudinal patient timeline for healing progress monitoring.
- Severity/risk scoring with configurable clinical escalation rules.
- Improved robustness across skin tones, lighting, and device quality.
- On-device/mobile inference options for low-connectivity settings.

## License

See [LICENSE](LICENSE)
