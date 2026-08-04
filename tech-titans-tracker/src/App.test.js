import { render, screen } from '@testing-library/react';
import App from './App';

// Firebase is mocked so the test is deterministic and doesn't depend on
// network access, IndexedDB, or a real Firebase project.
jest.mock('./firebase', () => ({
  auth: {},
  provider: {},
  db: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth, callback) => {
    callback(null);
    return () => {};
  },
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

test('renders the sign-in screen when no user is authenticated', () => {
  render(<App />);
  expect(screen.getByText(/tech titans tracker/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
});
