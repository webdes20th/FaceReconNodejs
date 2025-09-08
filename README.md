# Face Recognition App with Dashboard

A comprehensive face recognition application using face-api.js with a beautiful dashboard interface, built for Thai users.

## 🚀 Features

### Face Recognition
- Real-time face detection using webcam
- Face recognition with saved profiles
- Upload images for face detection
- Expression detection
- High accuracy face matching

### User Management
- Complete user profile registration (Thai/English names, ID info, etc.)
- Profile photo capture from camera
- Detailed personal information storage
- Profile editing with modal interface

### Dashboard System
- **Automatic login** when face is recognized
- Beautiful Thai language dashboard
- Complete user profile display
- Statistics cards with organized information
- Responsive design for all devices

### New Features ✨
- **Login Button**: Appears when face is successfully detected
- **Dashboard Interface**: Professional layout similar to government systems
- **Thai Language Support**: Full Thai interface
- **Error Handling**: Comprehensive error management
- **Data Security**: LocalStorage-based data management

## 📁 File Structure

```
├── public/
│   ├── index.html          # Main face recognition interface
│   ├── dashboard.html      # User dashboard (NEW)
│   ├── test-dashboard.html # Testing utility (NEW)
│   ├── script.js          # Main application logic
│   └── models/            # Face-api.js model files
├── src/
│   └── index.js           # Express server
└── package.json
```

## 🛠️ Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Open your browser and go to:**
   - Main app: `http://localhost:3000`
   - Test dashboard: `http://localhost:3000/test-dashboard.html`

## 🎯 Usage

### 1. Face Recognition & Login
1. **Start Camera**: Access your webcam
2. **Add Profiles**: Register users with complete information
3. **Recognize Faces**: System detects and recognizes faces
4. **Login to Dashboard**: Click the login button when face is recognized

### 2. Dashboard Features
- **Profile Overview**: User photo, name, and confidence level
- **Personal Information**: Thai/English names, birth date, age, weight
- **ID Information**: ID type, number, issue place
- **Cultural Information**: Nationality, language, religion  
- **Location Information**: Country, province, district

### 3. Testing
Use `test-dashboard.html` to:
- Create test users without face recognition
- Test dashboard functionality
- Debug data storage issues

## 🔧 Technical Details

### Models Used
- **Face Detection**: SSD MobileNet v1, Tiny Face Detector
- **Face Landmarks**: 68-point facial landmark detection
- **Face Recognition**: Deep learning feature extraction
- **Expressions**: Real-time emotion detection

### Data Storage
- **LocalStorage**: User profiles and face data
- **No Server Database**: All data stored locally
- **Privacy Focused**: Data never leaves the device

### Error Handling
- **URL Length Protection**: Prevents browser URL limits
- **Data Validation**: Comprehensive input validation
- **Graceful Fallbacks**: Error states with user guidance
- **Console Logging**: Detailed debugging information

## 🌐 Browser Support

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ Requires WebRTC support for camera access

## 🎨 Design Features

- **Thai Language Interface**: Complete localization
- **Responsive Design**: Works on desktop and mobile
- **Modern UI**: Gradient backgrounds and smooth animations
- **Government-Style Dashboard**: Professional appearance
- **Color-Coded Sections**: Easy navigation and information grouping

## 🔐 Security & Privacy

- **Local Processing**: All face recognition happens in the browser
- **No Data Upload**: Face data never sent to servers
- **Secure Storage**: LocalStorage with error handling
- **Privacy First**: No external dependencies for face processing

## 🚨 Troubleshooting

### Dashboard Won't Load
1. Check browser console for errors
2. Use `test-dashboard.html` to create test data
3. Clear localStorage and try again
4. Ensure face recognition was successful first

### Face Recognition Issues
1. Ensure good lighting
2. Face should be clearly visible
3. Try different angles
4. Check camera permissions

### URL Too Long Error (Fixed)
- Previous versions had URL parameter issues
- Now uses localStorage exclusively
- No more Safari "can't open page" errors

## 📝 Development Notes

This version includes major improvements:
- Fixed URL length issues that caused Safari errors
- Added comprehensive error handling
- Improved dashboard loading process
- Enhanced user experience with better feedback
- Added testing utilities for development

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## Technologies Used

- HTML, CSS, JavaScript
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - JavaScript API for face detection and recognition in the browser
- Express.js - Web server for serving static files
- Browser LocalStorage - For storing face profiles

## License

This project is licensed under the MIT License.

## Acknowledgements

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for the face detection and recognition functionality.