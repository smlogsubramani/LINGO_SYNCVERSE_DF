import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  Timestamp,
  getDoc,
  serverTimestamp,
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

// Ticket type used by the service (keeps shape compatible with your UI)
export interface Ticket {
  id: string;
  ticketCode?: string;
  title: string;
  description: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  status: string;
  createdBy: string;
  type?: string;
  requestedDeveloper?: string;
  contactReason?: string;
  assignedToName?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketsCollection = collection(db, "tickets");

function mapFirestoreTicket(docSnap: any): Ticket {
  const data = docSnap.data();
  // Convert Firestore Timestamps to JS Dates safely
  const createdAt = data.createdAt ? (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date();
  const updatedAt = data.updatedAt ? (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)) : new Date();

  return {
    id: docSnap.id,
    ticketCode: data.ticketCode,
    title: data.title,
    description: data.description,
    category: data.category,
    subCategory: data.subCategory,
    priority: data.priority,
    status: data.status,
    createdBy: data.createdBy,
    type: data.type,
    requestedDeveloper: data.requestedDeveloper,
    contactReason: data.contactReason,
    assignedToName: data.assignedToName,
    rejectionReason: data.rejectionReason,
    createdAt,
    updatedAt
  } as Ticket;
}

export const ticketService = {
  // Subscribe to tickets in realtime, role-aware
  subscribeToUserTickets: (
    userId: string,
    userRole: string,
    callback: (tickets: Ticket[]) => void
  ): (() => void) => {
    let q;
    if (userRole === "admin") {
      q = query(ticketsCollection, orderBy("createdAt", "desc"));
    } else if (userRole === "developer") {
      // Developers see tickets assigned to them (match by assignedToName or requestedDeveloper if desired)
      q = query(ticketsCollection, where("assignedToName", "==", userId), orderBy("createdAt", "desc"));
    } else {
      // clients see their own tickets
      q = query(ticketsCollection, where("createdBy", "==", userId), orderBy("createdAt", "desc"));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tickets = snapshot.docs.map(mapFirestoreTicket);
        callback(tickets);
      },
      (error) => {
        console.error("Error fetching tickets:", error);
        callback([]);
      }
    );

    return unsubscribe;
  },

  // Create a new ticket. Expects the DB-managed timestamps; returns the new doc id.
  createTicket: async (ticketData: Omit<Ticket, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    const payload: any = {
      ...ticketData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(ticketsCollection, payload);
    return docRef.id;
  },

  // Get single ticket by id
  getTicketById: async (id: string): Promise<Ticket | null> => {
    const docRef = doc(db, "tickets", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return mapFirestoreTicket(snap);
  }
};

export default ticketService;
