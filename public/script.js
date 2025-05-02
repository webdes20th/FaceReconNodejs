// Import face-api.js script
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
document.head.append(script);

// Initialize elements and variables
let video;
let canvas;
let displaySize;
let isModelLoaded = false;
let stream = null;
let labeledFaceDescriptors = [];
let faceMatcher = null;
let capturedImageURL = null;

// Wait for the face-api.js to load
script.onload = async () => {
    // DOM elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    const startButton = document.getElementById('startVideo');
    const stopButton = document.getElementById('stopVideo');
    const detectButton = document.getElementById('detectFace');
    const recognizeButton = document.getElementById('recognizeFace');
    const imageUpload = document.getElementById('imageUpload');
    const loadingElement = document.getElementById('loading');
    const detectionsElement = document.getElementById('detections');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const personNameInput = document.getElementById('personName');
    const faceUploadInput = document.getElementById('faceUpload');
    const captureFaceButton = document.getElementById('captureFace');
    const addPersonButton = document.getElementById('addPerson');
    const referenceContainer = document.getElementById('referenceContainer');

    // Initially disable buttons until models are loaded
    startButton.disabled = true;
    stopButton.disabled = true;
    detectButton.disabled = true;
    recognizeButton.disabled = true;
    captureFaceButton.disabled = true;
    addPersonButton.disabled = true;

    // Tab switching functionality
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = `${tab.dataset.tab}-tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Show loading message
    loadingElement.style.display = 'block';

    // Load face-api models
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('/models/face-api-models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api-models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api-models'),
            faceapi.nets.faceExpressionNet.loadFromUri('/models/face-api-models'),
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api-models') // For better face detection
        ]);

        // Models loaded successfully
        isModelLoaded = true;
        loadingElement.style.display = 'none';
        startButton.disabled = false;
        detectButton.disabled = false;
        recognizeButton.disabled = false;
        captureFaceButton.disabled = false;

        console.log('Models loaded successfully');

        // Load saved profiles from localStorage
        loadProfiles();
    } catch (error) {
        console.error('Error loading models:', error);
        loadingElement.textContent = 'Error loading models. Please check console for details.';
    }

    // Start video button click handler
    startButton.addEventListener('click', startVideo);

    // Stop video button click handler
    stopButton.addEventListener('click', stopVideo);

    // Detect face button click handler
    detectButton.addEventListener('click', detectFaces);

    // Recognize face button click handler
    recognizeButton.addEventListener('click', recognizeFaces);

    // Image upload handler
    imageUpload.addEventListener('change', handleImageUpload);

    // Capture face from camera button click handler
    captureFaceButton.addEventListener('click', captureFaceFromCamera);

    // Add person button click handler
    addPersonButton.addEventListener('click', addPersonFromUpload);

    // Face upload handler
    faceUploadInput.addEventListener('change', () => {
        // Clear previous captured image
        capturedImageURL = null;

        // Enable add person button if name is provided
        addPersonButton.disabled = !personNameInput.value.trim();
    });

    // Person name input handler
    personNameInput.addEventListener('input', () => {
        // Enable add person button if name and either face upload or captured image exist
        addPersonButton.disabled = !(personNameInput.value.trim() && (faceUploadInput.files[0] || capturedImageURL));
    });

    // Set up canvas
    const ctx = canvas.getContext('2d');

    // Function to start the video stream
    async function startVideo() {
        if (!isModelLoaded) return;

        // Check for secure context (HTTPS) when deployed to a server
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            detectionsElement.innerHTML = '<p>Camera access requires HTTPS on deployed servers. Please use HTTPS to access this page.</p>';
            console.error('Camera access requires HTTPS when deployed to a server');
            return;
        }

        try {
            // Check if mediaDevices is supported and add a polyfill if needed
            if (navigator.mediaDevices === undefined) {
                navigator.mediaDevices = {};
            }
            
            // Polyfill for older browsers
            if (navigator.mediaDevices.getUserMedia === undefined) {
                navigator.mediaDevices.getUserMedia = function(constraints) {
                    const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
                    
                    if (!getUserMedia) {
                        return Promise.reject(new Error("getUserMedia is not supported in this browser"));
                    }
                    
                    return new Promise(function(resolve, reject) {
                        getUserMedia.call(navigator, constraints, resolve, reject);
                    });
                };
            }
            
            stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            
            // Compatibility check for video.srcObject
            if ('srcObject' in video) {
                video.srcObject = stream;
            } else {
                // For older browsers
                video.src = window.URL.createObjectURL(stream);
            }

            // Wait for video to load metadata
            video.addEventListener('loadedmetadata', () => {
                // Set canvas size to match video
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(canvas, displaySize);

                startButton.disabled = true;
                stopButton.disabled = false;
                captureFaceButton.disabled = false;
            });

        } catch (error) {
            console.error('Error accessing camera:', error);
            detectionsElement.innerHTML = `<p>Error accessing camera: ${error.message}</p>`;
        }
    }

    // Function to stop the video stream
    function stopVideo() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            startButton.disabled = false;
            stopButton.disabled = true;
            captureFaceButton.disabled = true;
        }
    }

    // Function to detect faces
    async function detectFaces() {
        if (!isModelLoaded) return;

        if (!video.srcObject && !imageUpload.files[0]) {
            detectionsElement.innerHTML = '<p>Please start the camera or upload an image first.</p>';
            return;
        }

        try {
            // Clear previous detections
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // If we're using the webcam
            if (video.srcObject) {
                // Detect faces in the video
                const detections = await faceapi.detectAllFaces(video,
                    new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceExpressions();

                // Resize detections to match display size
                const resizedDetections = faceapi.resizeResults(detections, displaySize);

                // Draw the detections on the canvas
                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
                faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

                // Display detection results
                displayDetectionResults(detections);
            }
        } catch (error) {
            console.error('Error detecting faces:', error);
            detectionsElement.innerHTML = `<p>Error detecting faces: ${error.message}</p>`;
        }
    }

    // Function to recognize faces
    async function recognizeFaces() {
        if (!isModelLoaded) return;

        if (!video.srcObject && !imageUpload.files[0]) {
            detectionsElement.innerHTML = '<p>Please start the camera or upload an image first.</p>';
            return;
        }

        // Check if we have any saved face profiles
        if (labeledFaceDescriptors.length === 0) {
            detectionsElement.innerHTML = '<p>No face profiles found. Please add faces in the Manage Profiles tab first.</p>';
            return;
        }

        try {
            // Clear previous detections
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // If we're using the webcam
            if (video.srcObject) {
                // Detect faces with descriptors for recognition
                const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                // Resize detections to match display size
                const resizedDetections = faceapi.resizeResults(detections, displaySize);

                // Create face matcher if we haven't already
                if (!faceMatcher && labeledFaceDescriptors.length > 0) {
                    faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6); // 0.6 is the distance threshold
                }

                // Find best match for each face
                const results = resizedDetections.map(d => {
                    const bestMatch = faceMatcher.findBestMatch(d.descriptor);
                    return { detection: d, bestMatch };
                });

                // Draw boxes and labels
                results.forEach(result => {
                    const { detection, bestMatch } = result;
                    const box = detection.detection.box;
                    const text = bestMatch.toString();
                    const drawBox = new faceapi.draw.DrawBox(box, { label: text });
                    drawBox.draw(canvas);
                });

                // Display recognition results
                displayRecognitionResults(results);
            }
        } catch (error) {
            console.error('Error recognizing faces:', error);
            detectionsElement.innerHTML = `<p>Error recognizing faces: ${error.message}</p>`;
        }
    }

    // Function to handle image upload for detection/recognition
    async function handleImageUpload() {
        if (!isModelLoaded) return;

        const file = imageUpload.files[0];
        if (!file) return;

        try {
            // Stop video if it's running
            stopVideo();

            // Create an image element
            const img = await faceapi.bufferToImage(file);

            // Set canvas size to match image
            displaySize = { width: img.width, height: img.height };
            faceapi.matchDimensions(canvas, displaySize);

            // Draw the image on the canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Detect faces in the image
            const detections = await faceapi.detectAllFaces(img,
                new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();

            // Resize detections to match display size
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Draw the detections on the canvas
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

            // Display detection results
            displayDetectionResults(detections);

        } catch (error) {
            console.error('Error processing image:', error);
            detectionsElement.innerHTML = `<p>Error processing image: ${error.message}</p>`;
        }
    }

    // Function to capture face from camera for profile creation
    async function captureFaceFromCamera() {
        if (!isModelLoaded || !video.srcObject) {
            alert('Please start the camera first');
            return;
        }

        try {
            // Switch to profiles tab
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            document.querySelector('.tab[data-tab="profiles"]').classList.add('active');
            document.getElementById('profiles-tab').classList.add('active');

            // Take screenshot of current video frame
            const captureCanvas = document.createElement('canvas');
            const context = captureCanvas.getContext('2d');
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

            // Store the captured image as data URL
            capturedImageURL = captureCanvas.toDataURL('image/png');

            // Create a preview if doesn't exist
            let previewContainer = document.getElementById('capturedImagePreview');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.id = 'capturedImagePreview';
                previewContainer.style.marginTop = '10px';
                previewContainer.style.marginBottom = '10px';
                previewContainer.style.maxWidth = '300px';

                // Insert after the faceUpload input
                faceUploadInput.parentNode.insertAdjacentElement('afterend', previewContainer);
            }

            // Display the captured image preview
            previewContainer.innerHTML = `
                <p>Captured Image:</p>
                <img src="${capturedImageURL}" alt="Captured face" style="max-width: 100%; border-radius: 4px; border: 1px solid #ddd;">
            `;

            // Clear any existing file in the file input
            faceUploadInput.value = '';

            // Enable add person button if name is provided
            addPersonButton.disabled = !personNameInput.value.trim();

        } catch (error) {
            console.error('Error capturing face:', error);
            alert('Error capturing face. Please try again.');
        }
    }

    // Function to add person from uploaded face image or captured image
    async function addPersonFromUpload() {
        if (!isModelLoaded) return;

        const name = personNameInput.value.trim();
        let imgToProcess;

        if (!name) {
            alert('Please provide a name/ID');
            return;
        }

        try {
            // Check if we have a captured image or an uploaded file
            if (capturedImageURL) {
                // Create a temporary image from the captured data URL
                imgToProcess = await createImageFromDataURL(capturedImageURL);
            } else if (faceUploadInput.files[0]) {
                // Process the uploaded file
                imgToProcess = await faceapi.bufferToImage(faceUploadInput.files[0]);
            } else {
                alert('Please provide a face image by uploading or capturing');
                return;
            }

            // Detect face in the image
            const detections = await faceapi.detectSingleFace(imgToProcess)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detections) {
                alert('No face detected in the image. Please try again with a clearer image.');
                return;
            }

            // Create labeled face descriptor
            const descriptor = detections.descriptor;
            const labeledDescriptor = new faceapi.LabeledFaceDescriptors(name, [descriptor]);

            // Check if this person already exists
            const existingIndex = labeledFaceDescriptors.findIndex(ld => ld.label === name);
            if (existingIndex !== -1) {
                // Replace existing descriptor
                labeledFaceDescriptors[existingIndex] = labeledDescriptor;
            } else {
                // Add new descriptor
                labeledFaceDescriptors.push(labeledDescriptor);
            }

            // Save face data with either the captured image or uploaded file
            if (capturedImageURL) {
                saveFaceDataFromURL(name, descriptor, capturedImageURL);
            } else {
                saveFaceDataFromFile(name, descriptor, faceUploadInput.files[0]);
            }

            // Update face matcher
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

            // Clear inputs and captured image
            personNameInput.value = '';
            faceUploadInput.value = '';
            capturedImageURL = null;

            // Clear preview if exists
            const previewContainer = document.getElementById('capturedImagePreview');
            if (previewContainer) {
                previewContainer.innerHTML = '';
            }

            // Disable add person button
            addPersonButton.disabled = true;

            alert(`Profile for ${name} has been saved!`);

        } catch (error) {
            console.error('Error adding person:', error);
            alert('Error adding person. Please try again.');
        }
    }

    // Helper function to create an image from data URL
    function createImageFromDataURL(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    // Function to save face data from file to localStorage
    function saveFaceDataFromFile(name, descriptor, file) {
        // Get existing profiles or create new array
        const profiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');

        // Create FileReader to convert image to data URL
        const reader = new FileReader();
        reader.onload = function (e) {
            const imageDataUrl = e.target.result;

            // Check if profile already exists
            const existingIndex = profiles.findIndex(p => p.name === name);
            if (existingIndex !== -1) {
                // Update existing profile
                profiles[existingIndex] = {
                    name,
                    descriptor: Array.from(descriptor),
                    imageDataUrl
                };
            } else {
                // Add new profile
                profiles.push({
                    name,
                    descriptor: Array.from(descriptor),
                    imageDataUrl
                });
            }

            // Save to localStorage
            localStorage.setItem('faceProfiles', JSON.stringify(profiles));

            // Update displayed profiles
            displaySavedProfiles();
        };
        reader.readAsDataURL(file);
    }

    // Function to save face data from URL to localStorage
    function saveFaceDataFromURL(name, descriptor, imageDataUrl) {
        // Get existing profiles or create new array
        const profiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');

        // Check if profile already exists
        const existingIndex = profiles.findIndex(p => p.name === name);
        if (existingIndex !== -1) {
            // Update existing profile
            profiles[existingIndex] = {
                name,
                descriptor: Array.from(descriptor),
                imageDataUrl
            };
        } else {
            // Add new profile
            profiles.push({
                name,
                descriptor: Array.from(descriptor),
                imageDataUrl
            });
        }

        // Save to localStorage
        localStorage.setItem('faceProfiles', JSON.stringify(profiles));

        // Update displayed profiles
        displaySavedProfiles();
    }

    // Function to load profiles from localStorage
    function loadProfiles() {
        // Get profiles from localStorage
        const profiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');

        // Convert to labeled face descriptors
        labeledFaceDescriptors = profiles.map(profile => {
            const descriptor = new Float32Array(profile.descriptor);
            return new faceapi.LabeledFaceDescriptors(profile.name, [descriptor]);
        });

        // Create face matcher if we have profiles
        if (labeledFaceDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
        }

        // Update UI
        displaySavedProfiles();
    }

    // Function to display saved profiles
    function displaySavedProfiles() {
        // Get profiles from localStorage
        const profiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');

        // Clear container
        referenceContainer.innerHTML = '';

        if (profiles.length === 0) {
            referenceContainer.innerHTML = '<p>No profiles saved yet. Add a person to get started.</p>';
            return;
        }

        // Add each profile to the container
        profiles.forEach(profile => {
            const profileElement = document.createElement('div');
            profileElement.className = 'reference-face';

            const img = document.createElement('img');
            img.src = profile.imageDataUrl;
            img.alt = profile.name;

            const nameElement = document.createElement('div');
            nameElement.textContent = profile.name;

            const deleteButton = document.createElement('div');
            deleteButton.className = 'delete-btn';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', () => deleteProfile(profile.name));

            profileElement.appendChild(img);
            profileElement.appendChild(nameElement);
            profileElement.appendChild(deleteButton);

            referenceContainer.appendChild(profileElement);
        });
    }

    // Function to delete a profile
    function deleteProfile(name) {
        if (confirm(`Are you sure you want to delete the profile for ${name}?`)) {
            // Get profiles from localStorage
            const profiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');

            // Remove profile with matching name
            const updatedProfiles = profiles.filter(p => p.name !== name);

            // Save updated profiles
            localStorage.setItem('faceProfiles', JSON.stringify(updatedProfiles));

            // Update labeled face descriptors
            labeledFaceDescriptors = labeledFaceDescriptors.filter(ld => ld.label !== name);

            // Update face matcher
            if (labeledFaceDescriptors.length > 0) {
                faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
            } else {
                faceMatcher = null;
            }

            // Update UI
            displaySavedProfiles();
        }
    }

    // Function to display detection results
    function displayDetectionResults(detections) {
        if (detections.length === 0) {
            detectionsElement.innerHTML = '<p>No faces detected.</p>';
            return;
        }

        let html = `<p>Detected ${detections.length} face(s):</p>`;
        html += '<ul>';

        detections.forEach((detection, index) => {
            const expressions = detection.expressions;
            const dominantExpression = Object.keys(expressions).reduce((a, b) =>
                expressions[a] > expressions[b] ? a : b);

            html += `<li>Face ${index + 1}:<br>`;
            html += `Dominant expression: ${dominantExpression} (${(expressions[dominantExpression] * 100).toFixed(2)}%)<br>`;
            html += `Confidence: ${(detection.detection.score * 100).toFixed(2)}%`;
            html += '</li>';
        });

        html += '</ul>';
        detectionsElement.innerHTML = html;
    }

    // Function to display recognition results
    function displayRecognitionResults(results) {
        if (results.length === 0) {
            detectionsElement.innerHTML = '<p>No faces detected.</p>';
            return;
        }

        let html = `<p>Recognized ${results.length} face(s):</p>`;
        html += '<ul>';

        results.forEach((result, index) => {
            const { bestMatch } = result;

            html += `<li>Face ${index + 1}:<br>`;
            html += `Identified as: ${bestMatch.label}<br>`;
            html += `Confidence: ${((1 - bestMatch.distance) * 100).toFixed(2)}%`;
            html += '</li>';
        });

        html += '</ul>';
        detectionsElement.innerHTML = html;
    }
}; 