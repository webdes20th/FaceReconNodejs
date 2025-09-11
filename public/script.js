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
let userProfiles = []; // Store complete user profiles
let currentEditingProfile = null; // Store currently editing profile
let isEditMode = false; // Track edit mode state

// Registration form elements
let registrationForm;
let photoUpload;

// Modal elements
let profileModal;
let modalClose;
let editModeToggle;
let modalFooter;
let cancelEdit;
let saveChanges;

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

    // Registration form elements
    registrationForm = document.getElementById('registrationForm');
    photoUpload = document.getElementById('userPhoto');
    const captureFromCameraBtn = document.getElementById('captureFromCamera');

    // Modal elements
    profileModal = document.getElementById('profileModal');
    modalClose = document.getElementById('modalClose');
    editModeToggle = document.getElementById('editModeToggle');
    modalFooter = document.getElementById('modalFooter');
    cancelEdit = document.getElementById('cancelEdit');
    saveChanges = document.getElementById('saveChanges');

    // Initially disable buttons until models are loaded
    startButton.disabled = true;
    stopButton.disabled = true;
    detectButton.disabled = true;
    recognizeButton.disabled = true;
    if (captureFaceButton) captureFaceButton.disabled = true;
    if (addPersonButton) addPersonButton.disabled = true;

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
        if (captureFaceButton) captureFaceButton.disabled = false;

        console.log('Models loaded successfully');

        // Load saved profiles from localStorage
        loadProfiles();

        // Trigger form validation now that models are loaded
        validateRegistrationForm();
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

    // Debug API button click handler
    const debugAPIButton = document.getElementById('debugAPI');
    if (debugAPIButton) {
        debugAPIButton.addEventListener('click', debugAPICall);
    }

    // Test Recognition button click handler
    const testRecognitionButton = document.getElementById('testRecognition');
    if (testRecognitionButton) {
        testRecognitionButton.addEventListener('click', testRecognition);
    }


    // Image upload handler
    imageUpload.addEventListener('change', handleImageUpload);

    // Capture face from camera button click handler
    if (captureFaceButton) {
        captureFaceButton.addEventListener('click', captureFaceFromCamera);
    }

    // Add person button click handler - removed since it's now handled by form submit

    // Face upload handler
    if (faceUploadInput) {
        faceUploadInput.addEventListener('change', () => {
            // Clear previous captured image
            capturedImageURL = null;

            // Enable add person button if name is provided
            if (addPersonButton && personNameInput) {
                addPersonButton.disabled = !personNameInput.value.trim();
            }
        });
    }

    // Person name input handler
    if (personNameInput) {
        personNameInput.addEventListener('input', () => {
            // Enable add person button if name and either face upload or captured image exist
            if (addPersonButton && faceUploadInput) {
                addPersonButton.disabled = !(personNameInput.value.trim() && (faceUploadInput.files[0] || capturedImageURL));
            }
        });
    }

    // Registration form handlers
    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistrationSubmit);

        // Add form validation listeners
        setupFormValidation();
    }

    if (photoUpload) {
        photoUpload.addEventListener('change', handlePhotoUpload);
    }

    if (captureFromCameraBtn) {
        captureFromCameraBtn.addEventListener('click', capturePhotoForRegistration);
    }

    // Modal event listeners
    if (modalClose) {
        modalClose.addEventListener('click', closeProfileModal);
    }

    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeProfileModal();
            }
        });
    }

    if (editModeToggle) {
        editModeToggle.addEventListener('click', toggleEditMode);
    }

    if (cancelEdit) {
        cancelEdit.addEventListener('click', cancelEditMode);
    }

    if (saveChanges) {
        saveChanges.addEventListener('click', saveProfileChanges);
    }


    // Auto-calculate age when birth date changes
    const birthDateInput = document.getElementById('birthDate');
    const ageInput = document.getElementById('age');
    if (birthDateInput && ageInput) {
        birthDateInput.addEventListener('change', () => {
            const birthDate = new Date(birthDateInput.value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            ageInput.value = age >= 0 ? age : '';

            // Trigger form validation
            validateRegistrationForm();
        });
    }

    // Set up canvas
    const ctx = canvas.getContext('2d');

    // Setup form validation
    function setupFormValidation() {
        const requiredFields = ['titleTh', 'firstNameTh', 'lastNameTh', 'birthDate', 'nationality', 'language', 'citizenId'];
        const submitButton = document.getElementById('addPerson');

        // Add event listeners to all form inputs
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', validateRegistrationForm);
                field.addEventListener('change', validateRegistrationForm);
            }
        });

        // Also listen to photo upload
        if (photoUpload) {
            photoUpload.addEventListener('change', validateRegistrationForm);
        }

        // Initial validation
        validateRegistrationForm();
    }

    // Validate registration form
    function validateRegistrationForm() {
        const submitButton = document.getElementById('addPerson');
        if (!submitButton) return;

        // Check required fields
        const requiredFields = ['titleTh', 'firstNameTh', 'lastNameTh', 'birthDate', 'nationality', 'language', 'citizenId'];
        let allRequiredFilled = true;

        for (const fieldId of requiredFields) {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                allRequiredFilled = false;
                break;
            }
        }

        // Check if photo is uploaded or captured
        const hasPhoto = (photoUpload && photoUpload.files[0]) || capturedImageURL;

        // Enable/disable submit button
        const canSubmit = allRequiredFilled && hasPhoto && isModelLoaded;
        submitButton.disabled = !canSubmit;

        // Update button appearance
        if (canSubmit) {
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
        } else {
            submitButton.style.opacity = '0.6';
            submitButton.style.cursor = 'not-allowed';
        }
    }

    // Function to start the video stream
    async function startVideo() {
        if (!isModelLoaded) return;

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            video.srcObject = stream;

            // Wait for video to load metadata
            video.addEventListener('loadedmetadata', () => {
                // Set canvas size to match video
                displaySize = { width: video.videoWidth, height: video.videoHeight };
                faceapi.matchDimensions(canvas, displaySize);

                // Show video and hide placeholder
                const cameraPlaceholder = document.getElementById('cameraPlaceholder');
                if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
                video.style.display = 'block';

                startButton.disabled = true;
                stopButton.disabled = false;
                if (captureFaceButton) captureFaceButton.disabled = false;
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

            // Hide video and show placeholder
            const cameraPlaceholder = document.getElementById('cameraPlaceholder');
            if (cameraPlaceholder) cameraPlaceholder.style.display = 'flex';
            video.style.display = 'none';

            startButton.disabled = false;
            stopButton.disabled = true;
            if (captureFaceButton) captureFaceButton.disabled = true;
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
                await displayRecognitionResults(results);
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

            // Hide placeholder and show canvas with image
            const cameraPlaceholder = document.getElementById('cameraPlaceholder');
            if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';

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
                if (faceUploadInput) {
                    faceUploadInput.parentNode.insertAdjacentElement('afterend', previewContainer);
                }
            }

            // Display the captured image preview
            previewContainer.innerHTML = `
                <p>Captured Image:</p>
                <img src="${capturedImageURL}" alt="Captured face" style="max-width: 100%; border-radius: 4px; border: 1px solid #ddd;">
            `;

            // Clear any existing file in the file input
            if (faceUploadInput) faceUploadInput.value = '';

            // Enable add person button if name is provided
            if (addPersonButton && personNameInput) {
                addPersonButton.disabled = !personNameInput.value.trim();
            }

        } catch (error) {
            console.error('Error capturing face:', error);
            alert('Error capturing face. Please try again.');
        }
    }

    // Function to add person from uploaded face image or captured image (LEGACY - for old simple form)
    async function addPersonFromUpload() {
        if (!isModelLoaded) return;

        const name = personNameInput ? personNameInput.value.trim() : '';
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
            } else if (faceUploadInput && faceUploadInput.files[0]) {
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
            } else if (faceUploadInput && faceUploadInput.files[0]) {
                saveFaceDataFromFile(name, descriptor, faceUploadInput.files[0]);
            }

            // Update face matcher
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

            // Clear inputs and captured image
            if (personNameInput) personNameInput.value = '';
            if (faceUploadInput) faceUploadInput.value = '';
            capturedImageURL = null;

            // Clear preview if exists
            const previewContainer = document.getElementById('capturedImagePreview');
            if (previewContainer) {
                previewContainer.innerHTML = '';
            }

            // Disable add person button
            if (addPersonButton) addPersonButton.disabled = true;

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
            profileElement.className = 'reference-face clickable-profile';

            const img = document.createElement('img');
            img.src = profile.imageDataUrl;
            img.alt = profile.name;

            const nameElement = document.createElement('div');
            nameElement.textContent = profile.name;

            const deleteButton = document.createElement('div');
            deleteButton.className = 'delete-btn';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening modal when deleting
                deleteProfile(profile.name);
            });

            // Add click event to open profile modal
            profileElement.addEventListener('click', () => {
                openProfileModal(profile.name);
            });

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
            detectionsElement.innerHTML = `
                <div class="empty-results">
                    <div class="empty-results-icon">😔</div>
                    <div class="empty-results-text">ไม่พบใบหน้าในภาพ</div>
                    <div class="empty-results-subtitle">กรุณาลองใหม่ด้วยภาพที่ชัดเจนกว่า</div>
                </div>
            `;
            return;
        }

        let html = `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #2c3e50; display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="background: linear-gradient(135deg, #56ab2f, #a8e6cf); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">✓</span>
                    ตรวจพบใบหน้า
                </h3>
                <p style="color: #666; margin-left: 52px;">พบใบหน้า ${detections.length} คน</p>
            </div>
        `;

        detections.forEach((detection, index) => {
            const expressions = detection.expressions;
            const dominantExpression = Object.keys(expressions).reduce((a, b) =>
                expressions[a] > expressions[b] ? a : b);

            const confidence = (detection.detection.score * 100).toFixed(2);
            const expressionPercent = (expressions[dominantExpression] * 100).toFixed(2);

            // Map expression names to Thai
            const expressionMap = {
                'neutral': 'เฉยๆ',
                'happy': 'มีความสุข',
                'sad': 'เศร้า',
                'angry': 'โกรธ',
                'fearful': 'กลัว',
                'disgusted': 'รังเกียจ',
                'surprised': 'แปลกใจ'
            };

            const thaiExpression = expressionMap[dominantExpression] || dominantExpression;

            html += `
                <div style="
                    background: linear-gradient(145deg, #ffffff, #f8f9fa);
                    border-radius: 16px;
                    padding: 20px;
                    margin: 16px 0;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    border-left: 4px solid #56ab2f;
                ">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="
                            background: #56ab2f; color: white; 
                            width: 36px; height: 36px; border-radius: 50%; 
                            display: flex; align-items: center; justify-content: center;
                            font-size: 18px;
                        ">👤</span>
                        <div>
                            <h4 style="margin: 0; color: #2c3e50;">ใบหน้าที่ ${index + 1}</h4>
                            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">ตรวจจับสำเร็จ</p>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">อารมณ์หลัก</p>
                            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${thaiExpression}</p>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #56ab2f;">${expressionPercent}%</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <p style="margin: 0 0 4px 0; font-size: 14px; color: #666;">ความแม่นยำ</p>
                            <p style="margin: 0; font-weight: bold; color: #2c3e50;">${confidence}%</p>
                            <div style="
                                background: #e9ecef; 
                                height: 4px; 
                                border-radius: 2px; 
                                overflow: hidden;
                                margin-top: 4px;
                            ">
                                <div style="
                                    background: linear-gradient(135deg, #56ab2f, #a8e6cf);
                                    height: 100%; 
                                    width: ${confidence}%;
                                    border-radius: 2px;
                                "></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        detectionsElement.innerHTML = html;
    }

    // Function to display recognition results
    async function displayRecognitionResults(results) {
        if (results.length === 0) {
            detectionsElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                    <h3 style="color: #333; margin-bottom: 8px;">ไม่พบใบหน้าในภาพ</h3>
                    <p>กรุณาลองใหม่ด้วยภาพที่ชัดเจนกว่า</p>
                </div>
            `;
            return;
        }

        // Show loading state while fetching HIS data
        let loadingHtml = `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #2c3e50; display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">✓</span>
                    ผลการจดจำใบหน้า
                </h3>
                <p style="color: #666; margin-left: 52px;">พบใบหน้า ${results.length} คน</p>
            </div>
            <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 12px; margin: 16px 0;">
                <div style="width: 40px; height: 40px; border: 4px solid #e9ecef; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px;"></div>
                <p style="color: #666; margin: 0;">กำลังดึงข้อมูลสิทธิ์การรักษาจากระบบ HIS...</p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        detectionsElement.innerHTML = loadingHtml;

        let html = `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #2c3e50; display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">✓</span>
                    ผลการจดจำใบหน้า
                </h3>
                <p style="color: #666; margin-left: 52px;">พบใบหน้า ${results.length} คน</p>
            </div>
        `;

        // Process each result with async operations
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const { bestMatch } = result;
            const confidence = ((1 - bestMatch.distance) * 100).toFixed(2);

            // Find the complete user profile
            const userProfile = userProfiles.find(profile => profile.name === bestMatch.label);

            if (bestMatch.label !== 'unknown' && confidence > 50) {
                if (userProfile) {
                    // Display complete user information with beautiful design (async)
                    const cardHtml = await createBeautifulRecognitionCard(userProfile, confidence, i + 1);
                    html += cardHtml;
                } else {
                    // Fallback for basic recognition
                    html += createBasicRecognitionCard(bestMatch.label, confidence, i + 1);
                }
            } else {
                // Unknown person
                html += createUnknownPersonCard(confidence, i + 1);
            }
        }

        detectionsElement.innerHTML = html;
    }

    // Create beautiful recognition card with complete user details
    async function createBeautifulRecognitionCard(profile, confidence, faceNumber) {
        const personalInfo = profile.personalInfo;
        const confidenceColor = confidence > 80 ? '#27ae60' : confidence > 60 ? '#f39c12' : '#e74c3c';
        const confidenceIcon = confidence > 80 ? '🎯' : confidence > 60 ? '✅' : '⚠️';

        // Fetch HIS data if CID is available
        let hisData = null;
        let payorPlansHtml = '';
        
        if (personalInfo.citizenId) {
            try {
                hisData = await fetchPatientDataByCID(personalInfo.citizenId);
                
                if (hisData && !hisData.error) {
                    // Debug: Log the HIS data structure
                    console.log('HIS Data Structure:', JSON.stringify(hisData, null, 2));
                    console.log('PayorPlans exists:', !!hisData.data.lastEncounter.payorPlans);
                    console.log('PayorPlans is array:', Array.isArray(hisData.data.lastEncounter.payorPlans));
                    console.log('PayorPlans length:', hisData.data.lastEncounter.payorPlans?.length);
                    
                    if (hisData.data.lastEncounter.payorPlans && Array.isArray(hisData.data.lastEncounter.payorPlans) && hisData.data.lastEncounter.payorPlans.length > 0) {
                        console.log('Formatting payorPlans:', hisData.data.lastEncounter.payorPlans);
                        payorPlansHtml = formatPayorPlans(hisData.data.lastEncounter.payorPlans);
                    } else {
                        // API success but no payorPlans data
                        payorPlansHtml = `
                            <div style="margin-top: 16px; padding: 12px; background: #d1ecf1; border-left: 4px solid #0ea5e9; border-radius: 8px;">
                                <h4 style="color: #0369a1; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                                    <span>ℹ️</span> ข้อมูลสิทธิ์การรักษา
                                </h4>
                                <p style="margin: 0; color: #0369a1; font-size: 14px;">พบข้อมูลผู้ป่วยในระบบ HIS แต่ไม่มีข้อมูลสิทธิ์การรักษา</p>
                                <div style="margin-top: 8px; font-size: 12px; color: #0369a1;">
                                    <strong>CID:</strong> ${personalInfo.citizenId}<br>
                                    <strong>API Response:</strong> สำเร็จ<br>
                                    <strong>PayorPlans Type:</strong> ${typeof hisData.data.lastEncounter.payorPlans}<br>
                                    <strong>PayorPlans Value:</strong> ${JSON.stringify(hisData.data.lastEncounter.payorPlans)}
                                </div>
                            </div>
                        `;
                    }
                } else if (hisData && hisData.error) {
                    payorPlansHtml = `
                        <div style="margin-top: 16px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px;">
                            <h4 style="color: #856404; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                                <span>⚠️</span> ข้อมูลสิทธิ์การรักษา
                            </h4>
                            <p style="margin: 0; color: #856404; font-size: 14px;">${hisData.error}</p>
                            <div style="margin-top: 8px; font-size: 12px; color: #856404;">
                                <strong>CID:</strong> ${personalInfo.citizenId}
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error fetching HIS data:', error);
                payorPlansHtml = `
                    <div style="margin-top: 16px; padding: 12px; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 8px;">
                        <h4 style="color: #721c24; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                            <span>❌</span> ข้อผิดพลาดในการเชื่อมต่อ
                        </h4>
                        <p style="margin: 0; color: #721c24; font-size: 14px;">ไม่สามารถเชื่อมต่อกับระบบ HIS ได้</p>
                        <div style="margin-top: 8px; font-size: 12px; color: #721c24;">
                            <strong>CID:</strong> ${personalInfo.citizenId}<br>
                            <strong>Error:</strong> ${error.message}
                        </div>
                    </div>
                `;
            }
        } else {
            payorPlansHtml = `
                <div style="margin-top: 16px; padding: 12px; background: #e2e3e5; border-left: 4px solid #6c757d; border-radius: 8px;">
                    <h4 style="color: #495057; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <span>ℹ️</span> ข้อมูลสิทธิ์การรักษา
                    </h4>
                    <p style="margin: 0; color: #495057; font-size: 14px;">ไม่มีเลขบัตรประจำตัวประชาชนในระบบ</p>
                </div>
            `;
        }

        return `
            <div style="
                background: linear-gradient(145deg, #ffffff, #f8f9fa);
                border-radius: 20px;
                padding: 24px;
                margin: 20px 0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
                position: relative;
                overflow: hidden;
            ">
                <!-- Header with success indicator -->
                <div style="
                    background: linear-gradient(135deg, ${confidenceColor}, ${confidenceColor}dd);
                    color: white;
                    padding: 16px 20px;
                    margin: -24px -24px 20px -24px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                ">
                    <span style="font-size: 24px;">${confidenceIcon}</span>
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">จดจำใบหน้าสำเร็จ!</h3>
                        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">ความแม่นยำ ${confidence}%</p>
                    </div>
                </div>

                <!-- Profile Header -->
                <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px;">
                    <div style="position: relative;">
                        <img src="${profile.imageDataUrl}" alt="${profile.name}" 
                             style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; 
                                    border: 4px solid ${confidenceColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <div style="
                            position: absolute; bottom: -5px; right: -5px; 
                            background: ${confidenceColor}; color: white; 
                            width: 30px; height: 30px; border-radius: 50%; 
                            display: flex; align-items: center; justify-content: center;
                            font-size: 16px; border: 3px solid white;
                        ">✓</div>
                    </div>
                    <div style="flex: 1;">
                        <h2 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 24px;">${profile.name}</h2>
                        <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">รหัสผู้ใช้: ${profile.id}</p>
                        <p style="margin: 0; color: #666; font-size: 14px;">
                            ลงทะเบียนเมื่อ: ${new Date(profile.registrationDate).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric'
        })}
                        </p>
                    </div>
                </div>

                <!-- Personal Information Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                    
                    <!-- Basic Info Card -->
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; border-left: 4px solid #3498db;">
                        <h4 style="margin: 0 0 12px 0; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">👤</span> ข้อมูลส่วนตัว
                        </h4>
                        <div style="display: grid; gap: 8px; font-size: 14px;">
                            <div><strong>คำนำหน้า:</strong> ${personalInfo.titleTh || '-'} / ${personalInfo.titleEn || '-'}</div>
                            <div><strong>ชื่อ-นามสกุล (ไทย):</strong> ${personalInfo.firstNameTh || '-'} ${personalInfo.lastNameTh || '-'}</div>
                            <div><strong>ชื่อ-นามสกุล (อังกฤษ):</strong> ${personalInfo.firstNameEn || '-'} ${personalInfo.lastNameEn || '-'}</div>
                            <div><strong>วันเกิด:</strong> ${personalInfo.birthDate ? new Date(personalInfo.birthDate).toLocaleDateString('th-TH') : '-'}</div>
                            <div><strong>อายุ:</strong> ${personalInfo.age || '-'} ปี</div>
                            <div><strong>น้ำหนัก:</strong> ${personalInfo.weight || '-'} กก.</div>
                        </div>
                    </div>

                    <!-- ID Information Card -->
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; border-left: 4px solid #e67e22;">
                        <h4 style="margin: 0 0 12px 0; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">🆔</span> ข้อมูลบัตรประจำตัว
                        </h4>
                        <div style="display: grid; gap: 8px; font-size: 14px;">
                            <div><strong>ประเภทบัตร:</strong> ${personalInfo.idType || '-'}</div>
                            <div><strong>เลขบัตร:</strong> ${personalInfo.idNumber || '-'}</div>
                            <div><strong>สถานที่ออกบัตร:</strong> ${personalInfo.idIssuePlace || '-'}</div>
                            <div><strong>ประเภท:</strong> ${personalInfo.idCardType || '-'}</div>
                        </div>
                    </div>

                    <!-- Cultural Information Card -->
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; border-left: 4px solid #9b59b6;">
                        <h4 style="margin: 0 0 12px 0; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">🌍</span> ข้อมูลวัฒนธรรม
                        </h4>
                        <div style="display: grid; gap: 8px; font-size: 14px;">
                            <div><strong>สัญชาติ:</strong> ${personalInfo.nationality || '-'}</div>
                            <div><strong>ภาษา:</strong> ${personalInfo.language || '-'}</div>
                            <div><strong>ศาสนา:</strong> ${personalInfo.religion || '-'}</div>
                        </div>
                    </div>

                    <!-- Location Information Card -->
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; border-left: 4px solid #1abc9c;">
                        <h4 style="margin: 0 0 12px 0; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">📍</span> ที่อยู่
                        </h4>
                        <div style="display: grid; gap: 8px; font-size: 14px;">
                            <div><strong>ประเทศ:</strong> ${personalInfo.country || '-'}</div>
                            <div><strong>จังหวัด:</strong> ${personalInfo.province || '-'}</div>
                            <div><strong>เขต/อำเภอ:</strong> ${personalInfo.district || '-'}</div>
                        </div>
                    </div>
                </div>

                <!-- Footer with confidence meter and login button -->
                <div style="
                    margin-top: 20px; 
                    padding: 16px; 
                    background: linear-gradient(135deg, #667eea22, #764ba222);
                    border-radius: 12px;
                    text-align: center;
                ">
                    <div style="margin-bottom: 8px; color: #666; font-size: 14px;">ระดับความเชื่อมั่น</div>
                    <div style="
                        background: #e9ecef; 
                        height: 8px; 
                        border-radius: 4px; 
                        overflow: hidden;
                        margin: 0 auto;
                        max-width: 200px;
                    ">
                        <div style="
                            background: linear-gradient(135deg, ${confidenceColor}, ${confidenceColor}dd);
                            height: 100%; 
                            width: ${confidence}%;
                            border-radius: 4px;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <div style="margin-top: 8px; font-weight: bold; color: ${confidenceColor};">${confidence}%</div>
                    
                    <!-- Login Button -->
                    <div style="margin-top: 20px;">
                        <button onclick="loginToDashboard('${profile.name}', '${profile.id}', ${confidence})" style="
                            background: linear-gradient(135deg, #27ae60, #2ecc71);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 25px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);
                            transition: all 0.3s ease;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin: 0 auto;
                            max-width: 200px;
                            justify-content: center;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(39, 174, 96, 0.4)'" 
                           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(39, 174, 96, 0.3)'">
                            <span style="font-size: 18px;">🚀</span>
                            เข้าสู่ระบบ Dashboard
                        </button>
                    </div>
                </div>

                <!-- HIS Treatment Rights Information -->
                ${payorPlansHtml}
            </div>
        `;
    }

    // Create basic recognition card for fallback
    function createBasicRecognitionCard(name, confidence, faceNumber) {
        return `
            <div style="
                background: linear-gradient(145deg, #ffffff, #f8f9fa);
                border-radius: 16px;
                padding: 20px;
                margin: 16px 0;
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                border-left: 4px solid #3498db;
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="
                        background: #3498db; color: white; 
                        width: 36px; height: 36px; border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center;
                        font-size: 18px;
                    ">👤</span>
                    <div>
                        <h4 style="margin: 0; color: #2c3e50;">ใบหน้าที่ ${faceNumber}</h4>
                        <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">จดจำได้</p>
                    </div>
                </div>
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                    <p style="margin: 0 0 8px 0;"><strong>ชื่อ:</strong> ${name}</p>
                    <p style="margin: 0 0 16px 0;"><strong>ความแม่นยำ:</strong> <span style="color: #3498db; font-weight: bold;">${confidence}%</span></p>
                    
                    <!-- Login Button -->
                    <button onclick="loginToDashboardBasic('${name}', ${confidence})" style="
                        background: linear-gradient(135deg, #27ae60, #2ecc71);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 20px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        width: 100%;
                        box-shadow: 0 3px 10px rgba(39, 174, 96, 0.3);
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        justify-content: center;
                    " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 15px rgba(39, 174, 96, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(39, 174, 96, 0.3)'">
                        <span style="font-size: 16px;">🚀</span>
                        เข้าสู่ระบบ Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    // Create unknown person card
    function createUnknownPersonCard(confidence, faceNumber) {
        return `
            <div style="
                background: linear-gradient(145deg, #ffffff, #f8f9fa);
                border-radius: 16px;
                padding: 20px;
                margin: 16px 0;
                box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                border-left: 4px solid #e74c3c;
            ">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <span style="
                        background: #e74c3c; color: white; 
                        width: 36px; height: 36px; border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center;
                        font-size: 18px;
                    ">❓</span>
                    <div>
                        <h4 style="margin: 0; color: #2c3e50;">ใบหน้าที่ ${faceNumber}</h4>
                        <p style="margin: 4px 0 0 0; color: #e74c3c; font-size: 14px;">ไม่พบข้อมูลในระบบ</p>
                    </div>
                </div>
                <div style="background: #fff5f5; padding: 12px; border-radius: 8px; border: 1px solid #fed7d7;">
                    <p style="margin: 0 0 8px 0; color: #e74c3c;"><strong>สถานะ:</strong> ไม่พบในฐานข้อมูล</p>
                    <p style="margin: 0; color: #666;"><strong>ความแม่นยำ:</strong> ${confidence}%</p>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                        💡 หากต้องการให้ระบบจดจำบุคคลนี้ กรุณาลงทะเบียนในหน้า "Manage Profiles"
                    </p>
                </div>
            </div>
        `;
    }

    // Handle registration form submission
    async function handleRegistrationSubmit(event) {
        event.preventDefault();
        console.log('Form submitted - handleRegistrationSubmit called');

        if (!isModelLoaded) {
            alert('Models are still loading. Please wait.');
            return;
        }

        // Get form data
        const userData = {};

        // Extract all form fields
        const fields = [
            'titleTh', 'titleEn', 'firstNameTh', 'firstNameEn',
            'lastNameTh', 'lastNameEn', 'birthDate', 'age', 'weight',
            'idType', 'idNumber', 'citizenId', 'idIssuePlace', 'idCardType',
            'nationality', 'language', 'religion', 'country', 'province', 'district'
        ];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                userData[field] = element.value;
            }
        });

        // Validate required fields
        const requiredFields = ['titleTh', 'firstNameTh', 'lastNameTh', 'birthDate', 'nationality', 'language', 'citizenId'];
        const missingFields = requiredFields.filter(field => !userData[field]);

        if (missingFields.length > 0) {
            alert(`Please fill in required fields: ${missingFields.join(', ')}`);
            return;
        }

        // Check if photo is uploaded
        if (!photoUpload.files[0] && !capturedImageURL) {
            alert('Please upload a photo or capture from camera');
            return;
        }

        try {
            let imgToProcess;
            let imageDataUrl;

            // Process image
            if (capturedImageURL) {
                imgToProcess = await createImageFromDataURL(capturedImageURL);
                imageDataUrl = capturedImageURL;
            } else {
                imgToProcess = await faceapi.bufferToImage(photoUpload.files[0]);
                imageDataUrl = await fileToDataURL(photoUpload.files[0]);
            }

            // Detect face in the image
            const detections = await faceapi.detectSingleFace(imgToProcess)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detections) {
                alert('No face detected in the image. Please try again with a clearer image.');
                return;
            }

            // Create unique ID for user
            const userId = `user_${Date.now()}`;
            const userName = `${userData.firstNameTh} ${userData.lastNameTh}`;

            // Create complete user profile
            const userProfile = {
                id: userId,
                name: userName,
                imageDataUrl: imageDataUrl,
                descriptor: Array.from(detections.descriptor),
                personalInfo: userData,
                registrationDate: new Date().toISOString()
            };

            // Save to user profiles
            userProfiles.push(userProfile);
            localStorage.setItem('userProfiles', JSON.stringify(userProfiles));

            // Also save to face profiles for recognition
            const labeledDescriptor = new faceapi.LabeledFaceDescriptors(userName, [detections.descriptor]);
            labeledFaceDescriptors.push(labeledDescriptor);

            // Update face matcher
            faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

            // Save face profiles
            const faceProfiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');
            faceProfiles.push({
                name: userName,
                descriptor: Array.from(detections.descriptor),
                imageDataUrl: imageDataUrl
            });
            localStorage.setItem('faceProfiles', JSON.stringify(faceProfiles));

            // Show success message
            alert(`Registration successful! ${userName} has been registered.`);

            // Reset form
            registrationForm.reset();
            clearPhotoPreview();
            capturedImageURL = null;

            // Update profiles display
            displaySavedProfiles();

        } catch (error) {
            console.error('Error registering user:', error);
            alert('Error during registration. Please try again.');
        }
    }

    // Handle photo upload for registration
    function handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Clear captured image if exists
        capturedImageURL = null;

        // Create preview
        const reader = new FileReader();
        reader.onload = function (e) {
            showPhotoPreview(e.target.result);
            // Trigger form validation after photo is loaded
            validateRegistrationForm();
        };
        reader.readAsDataURL(file);
    }

    // Capture photo from camera for registration
    async function capturePhotoForRegistration() {
        if (!video.srcObject) {
            alert('Please start the camera first');
            return;
        }

        try {
            // Create canvas to capture frame
            const captureCanvas = document.createElement('canvas');
            const context = captureCanvas.getContext('2d');
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

            // Store captured image
            capturedImageURL = captureCanvas.toDataURL('image/png');

            // Clear file input
            photoUpload.value = '';

            // Show preview
            showPhotoPreview(capturedImageURL);

            // Trigger form validation
            validateRegistrationForm();

            alert('Photo captured successfully!');

        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Error capturing photo');
        }
    }

    // Show photo preview in registration form
    function showPhotoPreview(imageSrc) {
        const photoUploadContainer = document.getElementById('photoUpload');

        // Clear existing content
        photoUploadContainer.innerHTML = '';

        // Add preview image
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '10px';
        img.alt = 'Photo preview';

        // Add change button
        const changeBtn = document.createElement('button');
        changeBtn.type = 'button';
        changeBtn.style.display = 'block';
        changeBtn.style.margin = '10px auto';
        changeBtn.textContent = 'Change Photo';
        changeBtn.onclick = clearPhotoPreview;

        photoUploadContainer.appendChild(img);
        photoUploadContainer.appendChild(changeBtn);
    }

    // Clear photo preview
    function clearPhotoPreview() {
        const photoUploadContainer = document.getElementById('photoUpload');
        photoUploadContainer.innerHTML = `
            <p>Click to upload image or capture from camera</p>
            <input type="file" id="userPhoto" accept="image/*">
        `;

        // Re-attach event listener
        const newPhotoUpload = document.getElementById('userPhoto');
        if (newPhotoUpload) {
            newPhotoUpload.addEventListener('change', handlePhotoUpload);
            photoUpload = newPhotoUpload;
        }
    }

    // Helper function to convert file to data URL
    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Load user profiles on startup
    function loadUserProfiles() {
        userProfiles = JSON.parse(localStorage.getItem('userProfiles') || '[]');
    }

    // Initialize user profiles display
    loadUserProfiles();

    // Add test user with CID if no users exist
    function addTestUserIfNeeded() {
        if (userProfiles.length === 0) {
            const testUser = {
                name: "ทดสอบ ระบบ",
                personalInfo: {
                    titleTh: "นาย",
                    firstNameTh: "ทดสอบ",
                    lastNameTh: "ระบบ",
                    birthDate: "1990-01-01",
                    age: "34",
                    nationality: "ไทย",
                    language: "ไทย",
                    citizenId: "1100800358781"
                }
            };
            
            userProfiles.push(testUser);
            localStorage.setItem('userProfiles', JSON.stringify(userProfiles));
            console.log('✅ Added test user with CID:', testUser.personalInfo.citizenId);
        }
    }
    
    // Add test user on startup
    addTestUserIfNeeded();

    // Debug API Call function
    async function debugAPICall() {
        const testCID = '1100800358781';
        
        // Show loading
        detectionsElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="width: 50px; height: 50px; border: 4px solid #e9ecef; border-top: 4px solid #8b5cf6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="color: #8b5cf6; margin-bottom: 8px;">🔍 Debug API Call</h3>
                <p>Testing API with CID: <code>${testCID}</code></p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        try {
            const apiResponse = await fetchPatientDataByCID(testCID);
            
            let resultHtml = `
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #2c3e50; display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <span style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔍</span>
                        Debug API Response
                    </h3>
                    <p style="color: #666; margin-left: 52px;">CID: ${testCID}</p>
                </div>
            `;

            if (apiResponse && apiResponse.error) {
                resultHtml += `
                    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 16px 0; border-radius: 8px;">
                        <h4 style="color: #856404; margin: 0 0 8px 0;">⚠️ API Error</h4>
                        <p style="margin: 0; color: #856404;">${apiResponse.error}</p>
                    </div>
                `;
            } else if (apiResponse) {
                resultHtml += `
                    <div style="background: #d1f2eb; border-left: 4px solid #27ae60; padding: 16px; margin: 16px 0; border-radius: 8px;">
                        <h4 style="color: #1e8449; margin: 0 0 8px 0;">✅ API Success</h4>
                        <p style="margin: 0; color: #1e8449;">API Response received successfully</p>
                    </div>
                `;

                // Show payorPlans analysis
                if (apiResponse.payorPlans) {
                    const isArray = Array.isArray(apiResponse.payorPlans);
                    const length = isArray ? apiResponse.payorPlans.length : 'N/A';
                    
                    resultHtml += `
                        <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 16px; margin: 16px 0; border-radius: 8px;">
                            <h4 style="color: #2e7d32; margin: 0 0 12px 0;">🏥 PayorPlans Analysis</h4>
                            <div style="font-size: 14px; color: #2e7d32;">
                                <p><strong>Type:</strong> ${typeof apiResponse.payorPlans}</p>
                                <p><strong>Is Array:</strong> ${isArray}</p>
                                <p><strong>Length:</strong> ${length}</p>
                            </div>
                        </div>
                    `;

                    if (isArray && apiResponse.payorPlans.length > 0) {
                        resultHtml += `
                            <div style="background: #f0f8ff; border-left: 4px solid #007acc; padding: 16px; margin: 16px 0; border-radius: 8px;">
                                <h4 style="color: #005c99; margin: 0 0 12px 0;">📋 Formatted PayorPlans</h4>
                                ${formatPayorPlans(apiResponse.payorPlans)}
                            </div>
                        `;
                    }
                }

                // Show raw response
                resultHtml += `
                    <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 16px; margin: 16px 0; border-radius: 8px;">
                        <h4 style="color: #495057; margin: 0 0 12px 0;">📋 Raw API Response</h4>
                        <pre style="background: #343a40; color: #fff; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin: 0; max-height: 300px;">${JSON.stringify(apiResponse, null, 2)}</pre>
                    </div>
                `;
            }

            detectionsElement.innerHTML = resultHtml;

        } catch (error) {
            console.error('Debug API error:', error);
            detectionsElement.innerHTML = `
                <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 16px; margin: 16px 0; border-radius: 8px;">
                    <h4 style="color: #721c24; margin: 0 0 8px 0;">❌ Debug Failed</h4>
                    <p style="margin: 0; color: #721c24;">Error: ${error.message}</p>
                </div>
            `;
        }
    }

    // Test Recognition function
    async function testRecognition() {
        // Find test user
        const testUser = userProfiles.find(user => user.personalInfo.citizenId === '1100800358781');
        
        if (!testUser) {
            detectionsElement.innerHTML = `
                <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 16px; margin: 16px 0; border-radius: 8px;">
                    <h4 style="color: #721c24; margin: 0 0 8px 0;">❌ Test Failed</h4>
                    <p style="margin: 0; color: #721c24;">Test user not found. Please add a user with CID: 1100800358781</p>
                </div>
            `;
            return;
        }

        // Show loading
        detectionsElement.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="width: 50px; height: 50px; border: 4px solid #e9ecef; border-top: 4px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="color: #10b981; margin-bottom: 8px;">🧪 Testing Recognition</h3>
                <p>Simulating face recognition for: <strong>${testUser.name}</strong></p>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Simulate recognition delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Create recognition result
        const recognitionResult = {
            label: testUser.name,
            distance: 0.35,
            confidence: 85.5
        };

        // Display results using the same function as real recognition
        await displayRecognitionResults([recognitionResult]);
    }


    // Modal Functions

    // Open profile modal with user data
    function openProfileModal(userName) {
        // Find complete user profile
        const userProfile = userProfiles.find(profile => profile.name === userName);

        if (!userProfile) {
            // Fallback: try to find in basic profiles
            const basicProfile = JSON.parse(localStorage.getItem('faceProfiles') || '[]')
                .find(profile => profile.name === userName);

            if (basicProfile) {
                // Show basic profile info
                showBasicProfileModal(basicProfile);
            } else {
                alert('Profile not found');
            }
            return;
        }

        // Set current editing profile
        currentEditingProfile = userProfile;

        // Populate modal header
        document.getElementById('modalProfileImage').src = userProfile.imageDataUrl;
        document.getElementById('modalProfileName').textContent = userProfile.name;
        document.getElementById('modalProfileId').textContent = `รหัสผู้ใช้: ${userProfile.id}`;
        document.getElementById('modalRegistrationDate').textContent =
            `ลงทะเบียนเมื่อ: ${new Date(userProfile.registrationDate).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'long', day: 'numeric'
            })}`;

        // Populate profile data
        populateProfileData(userProfile.personalInfo);

        // Reset edit mode
        isEditMode = false;
        exitEditMode();

        // Show modal
        profileModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    // Show basic profile modal for profiles without full data
    function showBasicProfileModal(basicProfile) {
        currentEditingProfile = basicProfile;

        document.getElementById('modalProfileImage').src = basicProfile.imageDataUrl;
        document.getElementById('modalProfileName').textContent = basicProfile.name;
        document.getElementById('modalProfileId').textContent = 'รหัสผู้ใช้: -';
        document.getElementById('modalRegistrationDate').textContent = 'ลงทะเบียนเมื่อ: -';

        // Clear all fields
        const fieldValues = document.querySelectorAll('.field-value');
        fieldValues.forEach(field => {
            field.textContent = '-';
        });

        // Hide edit button for basic profiles
        editModeToggle.style.display = 'none';

        // Show modal
        profileModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Populate profile data in modal
    function populateProfileData(personalInfo) {
        const fieldMapping = {
            titleTh: personalInfo.titleTh || '-',
            titleEn: personalInfo.titleEn || '-',
            firstNameTh: personalInfo.firstNameTh || '-',
            firstNameEn: personalInfo.firstNameEn || '-',
            lastNameTh: personalInfo.lastNameTh || '-',
            lastNameEn: personalInfo.lastNameEn || '-',
            birthDate: personalInfo.birthDate ? new Date(personalInfo.birthDate).toLocaleDateString('th-TH') : '-',
            age: personalInfo.age ? `${personalInfo.age} ปี` : '-',
            weight: personalInfo.weight ? `${personalInfo.weight} กก.` : '-',
            idType: personalInfo.idType || '-',
            idNumber: personalInfo.idNumber || '-',
            idIssuePlace: personalInfo.idIssuePlace || '-',
            idCardType: personalInfo.idCardType || '-',
            nationality: personalInfo.nationality || '-',
            language: personalInfo.language || '-',
            religion: personalInfo.religion || '-',
            country: personalInfo.country || '-',
            province: personalInfo.province || '-',
            district: personalInfo.district || '-'
        };

        // Populate fields
        Object.entries(fieldMapping).forEach(([field, value]) => {
            const fieldElement = document.querySelector(`[data-field="${field}"]`);
            if (fieldElement) {
                fieldElement.textContent = value;
                // Store original value for editing
                fieldElement.dataset.originalValue = personalInfo[field] || '';
            }
        });
    }

    // Close profile modal
    function closeProfileModal() {
        if (isEditMode) {
            if (confirm('คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการปิดหน้าต่างนี้หรือไม่?')) {
                exitEditMode();
                profileModal.classList.remove('active');
                document.body.style.overflow = 'auto';
                currentEditingProfile = null;
            }
        } else {
            profileModal.classList.remove('active');
            document.body.style.overflow = 'auto';
            currentEditingProfile = null;
        }
    }

    // Toggle edit mode
    function toggleEditMode() {
        if (!currentEditingProfile || !currentEditingProfile.personalInfo) {
            alert('ไม่สามารถแก้ไขโปรไฟล์นี้ได้');
            return;
        }

        if (isEditMode) {
            exitEditMode();
        } else {
            enterEditMode();
        }
    }

    // Enter edit mode
    function enterEditMode() {
        isEditMode = true;
        editModeToggle.textContent = 'ยกเลิกการแก้ไข';
        editModeToggle.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        modalFooter.style.display = 'flex';

        // Convert field values to input elements
        const fieldValues = document.querySelectorAll('.field-value');
        fieldValues.forEach(fieldElement => {
            const fieldType = fieldElement.dataset.type;
            const fieldName = fieldElement.dataset.field;
            const currentValue = fieldElement.dataset.originalValue || '';

            let inputElement;

            if (fieldType === 'select') {
                inputElement = createSelectInput(fieldName, currentValue);
            } else if (fieldType === 'date') {
                inputElement = document.createElement('input');
                inputElement.type = 'date';
                inputElement.value = currentValue;
            } else if (fieldType === 'number') {
                inputElement = document.createElement('input');
                inputElement.type = 'number';
                inputElement.value = currentValue;
            } else {
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                inputElement.value = currentValue;
            }

            inputElement.className = 'field-value editable';
            inputElement.dataset.field = fieldName;
            inputElement.dataset.type = fieldType;
            inputElement.dataset.originalValue = currentValue;

            // Replace the div with input
            fieldElement.parentNode.replaceChild(inputElement, fieldElement);
        });
    }

    // Create select input based on field name
    function createSelectInput(fieldName, currentValue) {
        const select = document.createElement('select');
        select.className = 'field-value editable';

        const options = getSelectOptions(fieldName);

        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Please select';
        select.appendChild(emptyOption);

        // Add options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.value === currentValue) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });

        return select;
    }

    // Get select options for different fields
    function getSelectOptions(fieldName) {
        const optionsMap = {
            titleTh: [
                { value: 'นาย', text: 'นาย' },
                { value: 'นาง', text: 'นาง' },
                { value: 'นางสาว', text: 'นางสาว' }
            ],
            titleEn: [
                { value: 'Mr.', text: 'Mr.' },
                { value: 'Mrs.', text: 'Mrs.' },
                { value: 'Miss', text: 'Miss' }
            ],
            idType: [
                { value: 'National ID', text: 'National ID' },
                { value: 'Passport', text: 'Passport' },
                { value: 'Alien ID', text: 'Alien ID' }
            ],
            idCardType: [
                { value: 'Permanent', text: 'Permanent' },
                { value: 'Temporary', text: 'Temporary' }
            ],
            nationality: [
                { value: 'Thai', text: 'Thai' },
                { value: 'United States', text: 'United States' },
                { value: 'Other', text: 'Other' }
            ],
            language: [
                { value: 'Thai', text: 'Thai' },
                { value: 'Spanish', text: 'Spanish' },
                { value: 'English', text: 'English' },
                { value: 'Other', text: 'Other' }
            ],
            religion: [
                { value: 'Buddhism', text: 'Buddhism' },
                { value: 'Christianity', text: 'Christianity' },
                { value: 'Islam', text: 'Islam' },
                { value: 'Other', text: 'Other' }
            ],
            country: [
                { value: 'Thailand', text: 'Thailand' },
                { value: 'United States', text: 'United States' },
                { value: 'Other', text: 'Other' }
            ],
            province: [
                { value: 'Bangkok', text: 'Bangkok' },
                { value: 'Chiang Mai', text: 'Chiang Mai' },
                { value: 'Other', text: 'Other' }
            ],
            district: [
                { value: 'Bang Rak', text: 'Bang Rak' },
                { value: 'Sathorn', text: 'Sathorn' },
                { value: 'Other', text: 'Other' }
            ]
        };

        return optionsMap[fieldName] || [];
    }

    // Exit edit mode
    function exitEditMode() {
        isEditMode = false;
        editModeToggle.textContent = 'แก้ไขข้อมูล';
        editModeToggle.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
        modalFooter.style.display = 'none';

        // Convert input elements back to divs
        const fieldInputs = document.querySelectorAll('.field-value.editable');
        fieldInputs.forEach(inputElement => {
            const fieldName = inputElement.dataset.field;
            const originalValue = inputElement.dataset.originalValue;

            const divElement = document.createElement('div');
            divElement.className = 'field-value';
            divElement.dataset.field = fieldName;
            divElement.dataset.type = inputElement.dataset.type;
            divElement.dataset.originalValue = originalValue;

            // Format display value
            let displayValue = originalValue || '-';
            if (fieldName === 'birthDate' && originalValue) {
                displayValue = new Date(originalValue).toLocaleDateString('th-TH');
            } else if (fieldName === 'age' && originalValue) {
                displayValue = `${originalValue} ปี`;
            } else if (fieldName === 'weight' && originalValue) {
                displayValue = `${originalValue} กก.`;
            }

            divElement.textContent = displayValue;

            // Replace input with div
            inputElement.parentNode.replaceChild(divElement, inputElement);
        });
    }

    // Cancel edit mode
    function cancelEditMode() {
        exitEditMode();
    }

    // Save profile changes
    function saveProfileChanges() {
        if (!currentEditingProfile || !currentEditingProfile.personalInfo) {
            alert('ไม่พบข้อมูลโปรไฟล์');
            return;
        }

        // Collect updated data
        const updatedData = {};
        const fieldInputs = document.querySelectorAll('.field-value.editable');

        fieldInputs.forEach(input => {
            const fieldName = input.dataset.field;
            updatedData[fieldName] = input.value;
        });

        // Validate required fields
        const requiredFields = ['titleTh', 'firstNameTh', 'lastNameTh', 'birthDate', 'nationality', 'language'];
        const missingFields = requiredFields.filter(field => !updatedData[field]);

        if (missingFields.length > 0) {
            alert(`กรุณากรอกข้อมูลที่จำเป็น: ${missingFields.join(', ')}`);
            return;
        }

        // Auto-calculate age if birth date changed
        if (updatedData.birthDate) {
            const birthDate = new Date(updatedData.birthDate);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            updatedData.age = age >= 0 ? age.toString() : '';
        }

        // Update current profile
        currentEditingProfile.personalInfo = { ...currentEditingProfile.personalInfo, ...updatedData };

        // Update name if first or last name changed
        const newName = `${updatedData.firstNameTh} ${updatedData.lastNameTh}`;
        const oldName = currentEditingProfile.name;

        if (newName !== oldName) {
            currentEditingProfile.name = newName;

            // Update face recognition data
            const faceProfileIndex = labeledFaceDescriptors.findIndex(ld => ld.label === oldName);
            if (faceProfileIndex !== -1) {
                labeledFaceDescriptors[faceProfileIndex] = new faceapi.LabeledFaceDescriptors(
                    newName,
                    labeledFaceDescriptors[faceProfileIndex].descriptors
                );

                // Update face matcher
                faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
            }

            // Update basic face profiles
            const faceProfiles = JSON.parse(localStorage.getItem('faceProfiles') || '[]');
            const faceProfileIndex2 = faceProfiles.findIndex(p => p.name === oldName);
            if (faceProfileIndex2 !== -1) {
                faceProfiles[faceProfileIndex2].name = newName;
                localStorage.setItem('faceProfiles', JSON.stringify(faceProfiles));
            }
        }

        // Save updated profiles
        localStorage.setItem('userProfiles', JSON.stringify(userProfiles));

        // Update modal header
        document.getElementById('modalProfileName').textContent = currentEditingProfile.name;

        // Exit edit mode and refresh display
        exitEditMode();
        populateProfileData(currentEditingProfile.personalInfo);

        // Refresh profiles display
        displaySavedProfiles();

        alert('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว!');
    }

    // Login to Dashboard Functions

    // Login with complete user profile
    function loginToDashboard(userName, userId, confidence) {
        // Find the complete user profile
        const userProfile = userProfiles.find(profile => profile.name === userName);

        if (userProfile) {
            // Store user data for dashboard
            const dashboardData = {
                ...userProfile,
                confidence: confidence,
                loginTime: new Date().toISOString()
            };

            // Store in localStorage for dashboard access
            localStorage.setItem('currentUser', JSON.stringify(dashboardData));

            // Navigate to dashboard using only localStorage (no URL parameters)
            window.location.href = 'dashboard.html';
        } else {
            // Fallback to basic login
            loginToDashboardBasic(userName, confidence);
        }
    }

    // Login with basic profile (fallback)
    function loginToDashboardBasic(userName, confidence) {
        // Find basic profile data
        const basicProfile = JSON.parse(localStorage.getItem('faceProfiles') || '[]')
            .find(profile => profile.name === userName);

        if (basicProfile) {
            const dashboardData = {
                id: 'basic_' + Date.now(),
                name: userName,
                imageDataUrl: basicProfile.imageDataUrl,
                confidence: confidence,
                loginTime: new Date().toISOString(),
                personalInfo: {
                    // Basic profile doesn't have detailed info
                    firstNameTh: userName.split(' ')[0] || '',
                    lastNameTh: userName.split(' ').slice(1).join(' ') || '',
                    titleTh: 'ไม่ระบุ'
                }
            };

            // Store in localStorage for dashboard access
            localStorage.setItem('currentUser', JSON.stringify(dashboardData));

            // Navigate to dashboard using only localStorage (no URL parameters)
            window.location.href = 'dashboard.html';
        } else {
            alert('ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่อีกครั้ง');
        }
    }

    // API Functions for HIS Integration

    // Fetch patient data from HIS API using CID
    async function fetchPatientDataByCID(citizenId) {
        const API_BASE_URL = 'https://his-sandbox-uat.his-nonprod.everapp.io/openapi';
        const BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFlYzVkYmRiLWIyMjgtNGIzMy1hOGY4LTc1YTQ0YjllYjg2OSIsImFjY2Vzc1Rva2VuIjoiNGFiMmMyYmEtMDljYi00YjVmLTg1OTMtYzYyYTQwMTRmZjNiIiwiaWF0IjoxNzU3MTc4NzE3fQ.Y-NrUX5emxRlhZJE7QCIzYKPvwnqbCqej_AaPZsK_z0';
        
        console.log('🔍 Making API call for CID:', citizenId);
        
        try {
            const response = await fetch(`${API_BASE_URL}/patient/get-by-cid/${citizenId}`, {
                method: 'GET',
                headers: {
                    'Accept': '*/*',
                    'Authorization': `Bearer ${BEARER_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 API Response status:', response.status);

            if (!response.ok) {
                if (response.status === 404) {
                    return { error: 'ไม่พบข้อมูลผู้ป่วยในระบบ HIS' };
                }
                return { error: `เกิดข้อผิดพลาดในการเชื่อมต่อ API: ${response.status}` };
            }

            const patientData = await response.json();
            console.log('📋 Raw API Response:', patientData);
            console.log('🏥 PayorPlans in response:', patientData.data.lastEncounter.payorPlans);
            console.log('🔍 PayorPlans type:', typeof patientData.data.lastEncounter.payorPlans);
            console.log('📊 PayorPlans is array:', Array.isArray(patientData.data.lastEncounter.payorPlans));
            
            // Check if payorPlans exists and has data
            if (patientData.data.lastEncounter.payorPlans) {
                console.log('✅ PayorPlans found:', patientData.data.lastEncounter.payorPlans.length, 'items');
                patientData.data.lastEncounter.payorPlans.forEach((plan, index) => {
                    console.log(`Plan ${index + 1}:`, {
                        name: plan.name,
                        status: plan.status,
                        active: plan.active,
                        description: plan.description
                    });
                });
            } else {
                console.log('❌ No payorPlans found in response');
            }
            
            return patientData;

        } catch (error) {
            console.error('❌ Error fetching patient data:', error);
            return { 
                error: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ HIS',
                details: error.message 
            };
        }
    }

    // Format payor plans for display
    function formatPayorPlans(payorPlans) {
        if (!payorPlans || !Array.isArray(payorPlans) || payorPlans.length === 0) {
            return '<p style="color: #666; font-style: italic;">ไม่มีข้อมูลสิทธิ์การรักษา</p>';
        }

        let html = '<div style="margin-top: 16px;">';
        html += '<h4 style="color: #2c3e50; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">';
        html += '<span style="font-size: 18px;">🏥</span> สิทธิ์การรักษา</h4>';
        
        payorPlans.forEach((plan, index) => {
            // Check status from different possible fields
            const isActive = plan.status === 'Active' || plan.status === 'active' || plan.active === true || plan.isActive === true;
            const statusColor = isActive ? '#27ae60' : '#95a5a6';
            const statusText = isActive ? 'ใช้งานได้' : 'ไม่ใช้งาน';
            
            // Get plan name from different possible fields
            const planName = plan.name || plan.planName || `แผนการรักษา ${index + 1}`;
            const planCode = plan.code || plan.planCode || 'ไม่ระบุ';
            const planDescription = plan.description || '';
            
            // Get payor information if available
            const payorName = plan.payor?.name || '';
            const payorCode = plan.payor?.code || '';
            
            html += `
                <div style="
                    background: white; 
                    border-radius: 8px; 
                    padding: 12px; 
                    margin-bottom: 8px;
                    border-left: 4px solid ${statusColor};
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 4px;">
                                ${planName}
                            </div>
                            <div style="font-size: 13px; color: #666;">
                                รหัส: ${planCode}
                            </div>
                            ${payorName ? `<div style="font-size: 13px; color: #666;">ผู้จ่าย: ${payorName}</div>` : ''}
                        </div>
                        <div style="
                            background: ${statusColor}; 
                            color: white; 
                            padding: 4px 8px; 
                            border-radius: 12px; 
                            font-size: 11px; 
                            font-weight: bold;
                        ">
                            ${statusText}
                        </div>
                    </div>
                    
                    ${planDescription ? `
                        <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 13px; color: #555;">
                            <strong>รายละเอียด:</strong> ${planDescription}
                        </div>
                    ` : ''}
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 12px; margin-top: 8px;">
                        ${plan.priority ? `<div><strong>ลำดับความสำคัญ:</strong> ${plan.priority}</div>` : ''}
                        ${plan.coverage ? `<div><strong>ความคุ้มครอง:</strong> ${plan.coverage}</div>` : ''}
                        ${plan.copay ? `<div><strong>ค่าใช้จ่าย:</strong> ${plan.copay}</div>` : ''}
                        ${plan.validFrom ? `<div><strong>เริ่มต้น:</strong> ${new Date(plan.validFrom).toLocaleDateString('th-TH')}</div>` : ''}
                        ${plan.validTo ? `<div><strong>สิ้นสุด:</strong> ${new Date(plan.validTo).toLocaleDateString('th-TH')}</div>` : ''}
                        ${plan.createdAt ? `<div><strong>สร้างเมื่อ:</strong> ${new Date(plan.createdAt).toLocaleDateString('th-TH')}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    // Make functions globally available
    window.loginToDashboard = loginToDashboard;
    window.loginToDashboardBasic = loginToDashboardBasic;
    window.fetchPatientDataByCID = fetchPatientDataByCID;
}; 