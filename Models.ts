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
  academic: {
    name: string;
    date: string;
    uploader: Number;
    content: string;
  };
  student: {
    name: string;
    date: string;
    uploader: Number;
    content: string;
  };

  misc: {
    name: string;
    date: string;
    uploader: Number;
    content: string;
  };

  community: string;
}

export { Communities, User, Com_events, Comment, Upload_Log };
