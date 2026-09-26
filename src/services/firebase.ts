import { getAuth, User } from "@react-native-firebase/auth";
import { getFirestore, Firestore } from "@react-native-firebase/firestore";

/**
 * Firebase servis referansları (@react-native-firebase Modular SDK).
 * Native SDK kullanıldığı için Android ve iOS'ta offline persistence
 * otomatik olarak etkindir ve kuyruk yönetimi yerel diskte tutulur.
 */

export const authInstance = getAuth();
export const dbInstance = getFirestore();

export type { User, Firestore };
