export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  location?: string;
  avatar?: string;
  managerId?: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  createdBy: string;
  employees: Employee[];
}

export const mockEmployees: Employee[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    title: 'Chief Executive Officer',
    department: 'Executive',
    email: 'sarah.chen@company.com',
    phone: '+1 (555) 001-0001',
    location: 'New York, NY',
    avatar: 'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '2',
    name: 'Michael Rodriguez',
    title: 'Chief Technology Officer',
    department: 'Technology',
    email: 'michael.rodriguez@company.com',
    phone: '+1 (555) 001-0002',
    location: 'San Francisco, CA',
    managerId: '1',
    avatar: 'https://images.pexels.com/photos/3777943/pexels-photo-3777943.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '3',
    name: 'Lisa Thompson',
    title: 'Chief Financial Officer',
    department: 'Finance',
    email: 'lisa.thompson@company.com',
    phone: '+1 (555) 001-0003',
    location: 'New York, NY',
    managerId: '1',
    avatar: 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '4',
    name: 'David Kim',
    title: 'VP of Engineering',
    department: 'Technology',
    email: 'david.kim@company.com',
    phone: '+1 (555) 001-0004',
    location: 'San Francisco, CA',
    managerId: '2',
    avatar: 'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '5',
    name: 'Emily Davis',
    title: 'VP of Product',
    department: 'Product',
    email: 'emily.davis@company.com',
    phone: '+1 (555) 001-0005',
    location: 'Seattle, WA',
    managerId: '2',
    avatar: 'https://images.pexels.com/photos/3758105/pexels-photo-3758105.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '6',
    name: 'Robert Wilson',
    title: 'VP of Sales',
    department: 'Sales',
    email: 'robert.wilson@company.com',
    phone: '+1 (555) 001-0006',
    location: 'Chicago, IL',
    managerId: '1',
    avatar: 'https://images.pexels.com/photos/3772511/pexels-photo-3772511.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '7',
    name: 'Jennifer Martinez',
    title: 'VP of Marketing',
    department: 'Marketing',
    email: 'jennifer.martinez@company.com',
    phone: '+1 (555) 001-0007',
    location: 'Los Angeles, CA',
    managerId: '1',
    avatar: 'https://images.pexels.com/photos/3771120/pexels-photo-3771120.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '8',
    name: 'Daniel Brown',
    title: 'Senior Software Engineer',
    department: 'Technology',
    email: 'daniel.brown@company.com',
    phone: '+1 (555) 001-0008',
    location: 'San Francisco, CA',
    managerId: '4'
  },
  {
    id: '9',
    name: 'Amanda Johnson',
    title: 'Senior Software Engineer',
    department: 'Technology',
    email: 'amanda.johnson@company.com',
    phone: '+1 (555) 001-0009',
    location: 'Austin, TX',
    managerId: '4'
  },
  {
    id: '10',
    name: 'Kevin Lee',
    title: 'DevOps Engineer',
    department: 'Technology',
    email: 'kevin.lee@company.com',
    phone: '+1 (555) 001-0010',
    location: 'San Francisco, CA',
    managerId: '4'
  },
  {
    id: '11',
    name: 'Nicole Garcia',
    title: 'Product Manager',
    department: 'Product',
    email: 'nicole.garcia@company.com',
    phone: '+1 (555) 001-0011',
    location: 'Seattle, WA',
    managerId: '5',
    avatar: 'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '12',
    name: 'James Taylor',
    title: 'UX Designer',
    department: 'Product',
    email: 'james.taylor@company.com',
    phone: '+1 (555) 001-0012',
    location: 'Seattle, WA',
    managerId: '5'
  },
  {
    id: '13',
    name: 'Rachel White',
    title: 'Senior Sales Representative',
    department: 'Sales',
    email: 'rachel.white@company.com',
    phone: '+1 (555) 001-0013',
    location: 'Chicago, IL',
    managerId: '6'
  },
  {
    id: '14',
    name: 'Christopher Moore',
    title: 'Sales Development Representative',
    department: 'Sales',
    email: 'christopher.moore@company.com',
    phone: '+1 (555) 001-0014',
    location: 'Chicago, IL',
    managerId: '6'
  },
  {
    id: '15',
    name: 'Stephanie Anderson',
    title: 'Marketing Specialist',
    department: 'Marketing',
    email: 'stephanie.anderson@company.com',
    phone: '+1 (555) 001-0015',
    location: 'Los Angeles, CA',
    managerId: '7'
  },
  {
    id: '16',
    name: 'Thomas Jackson',
    title: 'Content Marketing Manager',
    department: 'Marketing',
    email: 'thomas.jackson@company.com',
    phone: '+1 (555) 001-0016',
    location: 'Los Angeles, CA',
    managerId: '7'
  },
  {
    id: '17',
    name: 'Maria Gonzalez',
    title: 'Financial Analyst',
    department: 'Finance',
    email: 'maria.gonzalez@company.com',
    phone: '+1 (555) 001-0017',
    location: 'New York, NY',
    managerId: '3',
    avatar: 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '18',
    name: 'Steven Harris',
    title: 'Accounting Manager',
    department: 'Finance',
    email: 'steven.harris@company.com',
    phone: '+1 (555) 001-0018',
    location: 'New York, NY',
    managerId: '3'
  },
  {
    id: '19',
    name: 'Laura Clark',
    title: 'HR Business Partner',
    department: 'Human Resources',
    email: 'laura.clark@company.com',
    phone: '+1 (555) 001-0019',
    location: 'New York, NY',
    managerId: '1',
    avatar: 'https://images.pexels.com/photos/3758105/pexels-photo-3758105.jpeg?auto=compress&cs=tinysrgb&w=150'
  },
  {
    id: '20',
    name: 'Andrew Lewis',
    title: 'Junior Software Engineer',
    department: 'Technology',
    email: 'andrew.lewis@company.com',
    phone: '+1 (555) 001-0020',
    location: 'San Francisco, CA',
    managerId: '8'
  },
  {
    id: '21',
    name: 'Melissa Young',
    title: 'Quality Assurance Engineer',
    department: 'Technology',
    email: 'melissa.young@company.com',
    phone: '+1 (555) 001-0021',
    location: 'Austin, TX',
    managerId: '9'
  },
  {
    id: '22',
    name: 'Brian Hall',
    title: 'Customer Success Manager',
    department: 'Sales',
    email: 'brian.hall@company.com',
    phone: '+1 (555) 001-0022',
    location: 'Chicago, IL',
    managerId: '6'
  },
  {
    id: '23',
    name: 'Christina Allen',
    title: 'Social Media Manager',
    department: 'Marketing',
    email: 'christina.allen@company.com',
    phone: '+1 (555) 001-0023',
    location: 'Los Angeles, CA',
    managerId: '16'
  },
  {
    id: '24',
    name: 'Matthew Wright',
    title: 'Data Analyst',
    department: 'Technology',
    email: 'matthew.wright@company.com',
    phone: '+1 (555) 001-0024',
    location: 'San Francisco, CA',
    managerId: '4'
  },
  {
    id: '25',
    name: 'Ashley Turner',
    title: 'Executive Assistant',
    department: 'Executive',
    email: 'ashley.turner@company.com',
    phone: '+1 (555) 001-0025',
    location: 'New York, NY',
    managerId: '1'
  }
];