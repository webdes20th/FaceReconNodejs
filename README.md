# Face Recognition Web App

A simple web application for facial recognition using face-api.js. This application can detect faces, facial landmarks, facial expressions, and identify people by matching against saved profiles.

## Features

- Real-time face detection using webcam
- Face detection from uploaded images
- Detection of facial landmarks
- Facial expression recognition
- **Create profiles with names/IDs for people you want to recognize**
- **Match detected faces against your saved profiles**
- **Store face profiles in your browser for future use**
- Responsive and easy-to-use interface

## Technologies Used

- HTML, CSS, JavaScript
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - JavaScript API for face detection and recognition in the browser
- Express.js - Web server for serving static files
- Browser LocalStorage - For storing face profiles

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/faceRecon.git
   cd faceRecon
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Face Detection
1. Go to the "Face Recognition" tab
2. Start your webcam by clicking the "Start Camera" button
3. Click "Detect Face" to analyze the current frame
4. Alternatively, upload an image using the file input to detect faces in the image

### Face Recognition
1. Go to the "Manage Profiles" tab
2. Add a person by either:
   - Uploading a face image and entering their name/ID
   - Taking a picture with your webcam using the "Capture From Camera" button
3. Return to the "Face Recognition" tab
4. Click "Recognize Face" to identify people in the camera view
5. The app will display the name/ID of recognized individuals along with confidence scores

## Project Structure

- `public/` - Frontend files
  - `index.html` - Main HTML file
  - `script.js` - Frontend JavaScript
  - `models/` - Contains face-api.js models
  - `images/` - Sample images (optional)
- `src/` - Server-side code
  - `index.js` - Express server

## How It Works

The application uses face-api.js to:
1. Detect faces in images or webcam video
2. Extract facial features and create a "face descriptor" (a numerical representation of the face)
3. Store these descriptors along with names/IDs
4. Match new faces against the stored descriptors to identify people

All face data is stored locally in your browser's localStorage and is not sent to any server.

## License

This project is licensed under the MIT License.

## Acknowledgements

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for the face detection and recognition functionality. 