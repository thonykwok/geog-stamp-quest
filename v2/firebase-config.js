/* Shared Firebase config for v2 */
const firebaseConfig = {
  apiKey: "AIzaSyBgoiufpYsPF4EsqOCqVQWbg9RWLRhCltc",
  authDomain: "cheung-chau-quest.firebaseapp.com",
  projectId: "cheung-chau-quest",
  storageBucket: "cheung-chau-quest.firebasestorage.app",
  messagingSenderId: "1093724794704",
  appId: "1:1093724794704:web:5aae4cdf6921644a9ac655"
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
