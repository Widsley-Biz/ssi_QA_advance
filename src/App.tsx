import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import CourseSelect from './components/CourseSelect';
import CourseIntro from './components/CourseIntro';
import QuizFlow from './components/QuizFlow';
import Dashboard from './components/Dashboard';
import LeaderView from './components/LeaderView';
import BoardView from './components/BoardView';
import AdminPanel from './components/AdminPanel';
import CertificationPage from './components/CertificationPage';
import CareerMapPage from './components/CareerMapPage';
import MyPage from './components/MyPage';
import ExamList from './components/ExamList';
import ExamFlow from './components/ExamFlow';
import ExamResult from './components/ExamResult';
import ExamPractical from './components/ExamPractical';

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<CourseSelect />} />
          <Route path="/course/:course_id" element={<CourseIntro />} />
          <Route path="/course/:course_id/quiz" element={<QuizFlow />} />
          <Route path="/course/:course_id/dashboard" element={<Dashboard />} />
          <Route path="/course/:course_id/dashboard/:userId" element={<Dashboard />} />
          <Route path="/team" element={<LeaderView />} />
          <Route path="/board" element={<BoardView />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/certifications" element={<CertificationPage />} />
          <Route path="/career" element={<CareerMapPage />} />
          <Route path="/exams" element={<ExamList />} />
          <Route path="/exams/:examId/take" element={<ExamFlow />} />
          <Route path="/exams/:examId/practical" element={<ExamPractical />} />
          <Route path="/exams/result/:attemptId" element={<ExamResult />} />
          {(user.role === 'board') && (
            <Route path="/admin/*" element={<AdminPanel />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
