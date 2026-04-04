let stream = null;
let capturedImageData = null;

const cameraBtn = document.getElementById("cameraBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const imagePreview = document.getElementById("imagePreview");
const captureBtn = document.getElementById("captureBtn");
const closeBtn = document.getElementById("closeBtn");
const mediaContainer = document.querySelector(".media-container");
const cameraControls = document.querySelector(".camera-controls");
const resultDiv = document.getElementById("result");
const loadingDiv = document.getElementById("loading");
const errorDiv = document.getElementById("error");

async function startCamera() {
  try {
    errorDiv.style.display = "none";
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
    };
    mediaContainer.style.display = "block";
    cameraControls.style.display = "flex";
    cameraBtn.disabled = true;
    uploadBtn.disabled = true;
  } catch (error) {
    showError("Camera access denied or not available: " + error.message);
  }
}

function captureImage() {
  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  capturedImageData = canvas.toDataURL("image/jpeg");
  imagePreview.src = capturedImageData;
  imagePreview.style.display = "block";
  video.style.display = "none";
  cameraControls.style.display = "none";

  setTimeout(() => predictImage(capturedImageData, "camera"), 500);
}

function closeCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;
  mediaContainer.style.display = "none";
  cameraControls.style.display = "none";
  imagePreview.style.display = "none";
  video.style.display = "block";
  cameraBtn.disabled = false;
  uploadBtn.disabled = false;
  resultDiv.classList.remove("show");
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    capturedImageData = e.target.result;
    imagePreview.src = capturedImageData;
    mediaContainer.style.display = "block";
    cameraControls.style.display = "flex";
    video.style.display = "none";
    cameraBtn.disabled = true;
    uploadBtn.disabled = true;

    setTimeout(() => predictImage(capturedImageData, "upload"), 500);
  };
  reader.readAsDataURL(file);

  fileInput.value = "";
}

async function predictImage(imageData, source) {
  try {
    errorDiv.style.display = "none";
    loadingDiv.style.display = "block";
    resultDiv.classList.remove("show");

    let response;

    if (source === "camera") {
      response = await fetch("/predict/camera", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: imageData }),
      });
    } else {
      const formData = new FormData();

      const blob = base64ToBlob(imageData);
      formData.append("file", blob, "image.jpg");

      response = await fetch("/predict/upload", {
        method: "POST",
        body: formData,
      });
    }

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || "Prediction failed");
      return;
    }

    displayResult(result);
  } catch (error) {
    showError("Error during prediction: " + error.message);
  } finally {
    loadingDiv.style.display = "none";
  }
}

function base64ToBlob(base64Data) {
  const base64 = base64Data.split(",")[1] || base64Data;
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: "image/jpeg" });
}

function displayResult(result) {
  const resultClass = document.getElementById("resultClass");
  const resultConfidence = document.getElementById("resultConfidence");
  const confidenceFill = document.getElementById("confidenceFill");
  const allPredictions = document.getElementById("allPredictions");

  resultClass.textContent = result.class || "Unknown";
  resultConfidence.textContent = `${result.confidence.toFixed(1)}% Confidence`;
  confidenceFill.style.width = `${result.confidence}%`;

  let predictionsHtml =
    '<div style="margin-top: 10px;"><strong>All Predictions:</strong></div>';
  const sorted = Object.entries(result.all_predictions).sort(
    (a, b) => b[1] - a[1],
  );

  sorted.forEach(([className, confidence]) => {
    predictionsHtml += `
      <div class="prediction-item">
        <span>${className}</span>
        <span>${confidence.toFixed(1)}%</span>
      </div>
    `;
  });

  allPredictions.innerHTML = predictionsHtml;
  resultDiv.classList.add("show");
}

function showError(message) {
  errorDiv.textContent = "❌ " + message;
  errorDiv.style.display = "block";
}

cameraBtn.addEventListener("click", startCamera);
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
captureBtn.addEventListener("click", captureImage);
closeBtn.addEventListener("click", closeCamera);

console.log("🏥 PocketDoc app loaded successfully");
