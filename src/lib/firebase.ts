import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  setLogLevel, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress benign connection warnings
setLogLevel('error');

const app = initializeApp(firebaseConfig);

const rawDbId = firebaseConfig.firestoreDatabaseId;
const targetDbId = rawDbId && rawDbId !== '(default)' ? rawDbId : undefined;

// Initialize Firestore with local cache for instant reload and responsive synchronization
let firestoreDb;
const cacheSettings = {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
};

try {
  firestoreDb = targetDbId
    ? initializeFirestore(app, cacheSettings, targetDbId)
    : initializeFirestore(app, cacheSettings);
} catch {
  firestoreDb = targetDbId
    ? initializeFirestore(app, {}, targetDbId)
    : initializeFirestore(app, {});
}

export const db = firestoreDb;

export const storage = getStorage(app);
export const auth = getAuth();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Ignore offline/transient reachability warnings to prevent app crash
  if (
    errorMessage.includes('Could not reach Cloud Firestore') ||
    errorMessage.includes('offline mode') ||
    errorMessage.includes('unavailable')
  ) {
    console.warn(`Firestore Transient Connection Notice (${operationType} on ${path}):`, errorMessage);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}
