interface Communities {
  name: string;
  members: number;
  resource: number;
  rating: number;
  tag: string;
  description: string;
  admin: number;
  com_image: string;
  privacy: string;
  reviews: Review[];
}

interface Review {
  name: string;
  student_id: number;
  date: string;
  rating: number;
  feedback: string;
}

interface User {
  student_id: number;
  phone: string;
  password: string;
  name: string;
  join_date: string;
  email: string;
  bio: string;
  batch: number;
  avatar: string;
  authenticated: number;
  department: string;
  community: string[];
}

interface Comment {
  name: string;
  id: number;
}

interface Com_events {
  tag: string[];
  title: string;
  description: string;
  date: string;
  scheduler: number;
  comments: Comment[];
}

interface Upload_Log {
  access: string;
  category_name: string;
  date: string;
  description: string;
  keywords: string[];
  academic: ContentTypes;
  student: ContentTypes;
  misc: ContentTypes;
  community: string;
}

interface ContentTypes {
  name?: string;
  date?: string;
  uploader?: Number;
  content?: string;
  publicId?: string;
  resourceType?: string;
  type?: string;
}

interface Bookmark {
  user: Number;
  uploadDate: Number;
  title: string;
  bookmarkDate: string;
  comTag: string;
}

interface Com_request {
  name: string;
  id: number;
  tag: string;
  email: string;
}

interface FAQ {
  question: string;
  subtitle: string;
  written_by: string;
  updated_on: string;
  description: string;
}

interface Passwords {
  oldPassword: string;
  password: string;
  student_id: number;
}

export {
  Communities,
  User,
  Com_events,
  Comment,
  Upload_Log,
  Bookmark,
  Com_request,
  FAQ,
  Passwords,
  ContentTypes,
  Review,
};
