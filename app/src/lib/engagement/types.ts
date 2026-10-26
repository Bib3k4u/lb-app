export type FeedbackCategory = 'FACILITY' | 'EQUIPMENT' | 'TRAINER' | 'CLEANLINESS' | 'BILLING' | 'APPLICATION' | 'OTHER';

export interface FeedbackResponse {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  ownedByCaller: boolean;
}

export interface FeedbackThread {
  id: string;
  locationId: string;
  title: string;
  category: FeedbackCategory;
  body: string;
  state: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  anonymous: boolean;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  ownedByCaller: boolean;
  responses: FeedbackResponse[];
}
