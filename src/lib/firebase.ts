import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

if (!apiKey || !authDomain || !projectId) {
  console.warn('Firebase/Identity Platform credentials not found. Running in demo mode.');
}

export const firebaseApp = apiKey && authDomain && projectId
  ? initializeApp({ apiKey, authDomain, projectId })
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
if (auth) auth.languageCode = 'ja'; // Googleログインのポップアップを日本語表示にする

export const googleProvider = new GoogleAuthProvider();
// @widsley.com のGoogle Workspaceアカウントのみ許可(アカウント選択画面での絞り込み。
// サーバー側でもemailドメインを再検証している)
googleProvider.setCustomParameters({ hd: 'widsley.com' });

/** data.ts からAPI呼び出し時に使うAuthorizationヘッダーを取得 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
