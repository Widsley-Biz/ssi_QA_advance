import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import AuthLoadingScreen from './components/AuthLoadingScreen';
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
import ExamGuide from './components/ExamGuide';
import MaterialViewer from './components/MaterialViewer';

function AppRoutes() {
  const { user, loading } = useAuth();

  // signInWithRedirectから戻った直後など、getRedirectResult/onAuthStateChanged/
  // プロフィール取得が完了するまでの数秒間。ここでログイン画面を出してしまうと
  // 一瞬ログインボタンが押せる状態に見えてしまい連打を誘発するため、
  // 判定が終わるまでは専用のローディング画面を出す
  if (loading) {
    return <AuthLoadingScreen />;
  }

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
          <Route path="/exams/:examId/guide" element={<ExamGuide />} />
          <Route path="/exams/:examId/materials/:materialId" element={<MaterialViewer />} />
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
