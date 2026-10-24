/* Pathfinder content and configuration.
   Everything a mentor or coordinator would edit lives in this file:
   mentors, office hours, webinars, careers and syllabus subjects. */
window.PF = window.PF || {};

PF.config = {
  siteName: 'Pathfinder',
  // Steps a student must finish before the 1:1 mentor request opens.
  oneToOneUnlock: 3,
  // Where a 1:1 request goes. A Google Form, WhatsApp link or mailto: all work.
  oneToOneUrl: 'mailto:mentors@example.org?subject=Pathfinder%201%3A1%20request',
  // Weekly group session. day: 0 = Sunday ... 6 = Saturday, time is IST (24h).
  officeHours: {
    title: 'Group office hours',
    day: 6,
    time: '17:00',
    minutes: 45,
    topic: 'Bring any question about your syllabus, projects or careers. Small group, cameras optional.',
    link: 'https://meet.google.com/'
  },
  // SAMPLE DATA. Replace with your real mentors.
  mentors: [
    { name: 'Mentor A', role: 'Software engineer, product company', topics: 'Web development, interviews', langs: 'English, Tamil' },
    { name: 'Mentor B', role: 'Data analyst, retail', topics: 'SQL, Python, dashboards', langs: 'English, Hindi' },
    { name: 'Mentor C', role: 'Cloud engineer, telecom', topics: 'Linux, cloud, DevOps', langs: 'English, Tamil' }
  ],
  // SAMPLE DATA. Replace with your real webinars. Dates are ISO with +05:30 (IST).
  webinars: [
    {
      title: 'From a small town to a tech job: three stories',
      speaker: 'Guest mentors',
      date: '2026-11-08T18:00:00+05:30',
      minutes: 60,
      about: 'Three engineers who studied in colleges like yours share what helped and what they would do differently.',
      link: 'https://meet.google.com/',
      recording: ''
    },
    {
      title: 'Your first project in a weekend',
      speaker: 'Mentor A',
      date: '2026-11-22T18:00:00+05:30',
      minutes: 60,
      about: 'Pick a tiny idea, build it live, and publish it for free. No prior experience needed.',
      link: 'https://meet.google.com/',
      recording: ''
    }
  ]
};

/* Subjects a student might see in a CS or IT syllabus.
   `why` says what it is in plain words, `used` says where industry uses it,
   `bridge` is a free place to learn it if the syllabus skips it. */
PF.subjects = [
  { id: 'c',      name: 'Programming in C or Python', why: 'How to give a computer step-by-step instructions.', used: 'Every software job starts here.', bridge: { l: 'CS50 free course', u: 'https://cs50.harvard.edu/x/' } },
  { id: 'ds',     name: 'Data Structures', why: 'Ways to organise data, like lists, stacks, trees and graphs.', used: 'Faster apps, search, maps, and most coding interviews.', bridge: { l: 'NPTEL courses', u: 'https://nptel.ac.in/' } },
  { id: 'algo',   name: 'Algorithms', why: 'Methods to solve problems efficiently.', used: 'Search engines, recommendations, route planning.', bridge: { l: 'NPTEL courses', u: 'https://nptel.ac.in/' } },
  { id: 'oop',    name: 'Object-Oriented Programming (Java or C++)', why: 'Organising big programs into small reusable parts.', used: 'Large company software, Android apps, games.', bridge: { l: 'Java on freeCodeCamp', u: 'https://www.freecodecamp.org/learn' } },
  { id: 'dbms',   name: 'Database Management (DBMS and SQL)', why: 'How data is stored and asked for.', used: 'Banking, shopping, hospitals, and almost every app.', bridge: { l: 'SQLBolt practice', u: 'https://sqlbolt.com/' } },
  { id: 'os',     name: 'Operating Systems', why: 'How a computer runs many programs at once.', used: 'Servers, Linux, cloud and security work.', bridge: { l: 'Linux Journey', u: 'https://linuxjourney.com/' } },
  { id: 'cn',     name: 'Computer Networks', why: 'How data travels across the internet.', used: 'Websites, telecom, cloud and security.', bridge: { l: 'Networking basics, freeCodeCamp', u: 'https://www.freecodecamp.org/learn' } },
  { id: 'se',     name: 'Software Engineering', why: 'How teams plan, build and test software together.', used: 'Every company project, from planning to release.', bridge: { l: 'roadmap.sh guides', u: 'https://roadmap.sh/' } },
  { id: 'web',    name: 'Web Technologies', why: 'HTML, CSS and JavaScript, the building blocks of websites.', used: 'Websites, web apps, dashboards.', bridge: { l: 'MDN Learn Web Development', u: 'https://developer.mozilla.org/en-US/docs/Learn' } },
  { id: 'math',   name: 'Engineering Mathematics', why: 'Algebra, matrices and calculus.', used: 'Machine learning, graphics, signal processing.', bridge: { l: 'Khan Academy', u: 'https://www.khanacademy.org/math' } },
  { id: 'prob',   name: 'Probability and Statistics', why: 'Measuring chance and making sense of data.', used: 'Data analysis, machine learning, A/B testing.', bridge: { l: 'Khan Academy statistics', u: 'https://www.khanacademy.org/math/statistics-probability' } },
  { id: 'ml',     name: 'Machine Learning', why: 'Programs that learn patterns from examples.', used: 'Recommendations, fraud detection, image and voice apps.', bridge: { l: 'Kaggle Learn', u: 'https://www.kaggle.com/learn' } },
  { id: 'ai',     name: 'Artificial Intelligence', why: 'Making software that can reason and decide.', used: 'Chatbots, assistants, automation.', bridge: { l: 'Hugging Face courses', u: 'https://huggingface.co/learn' } },
  { id: 'dw',     name: 'Data Mining and Warehousing', why: 'Collecting large data and finding useful patterns.', used: 'Business reports and analytics teams.', bridge: { l: 'Kaggle Learn', u: 'https://www.kaggle.com/learn' } },
  { id: 'ca',     name: 'Computer Architecture', why: 'What happens inside a processor and memory.', used: 'Performance work, embedded and cloud infrastructure.', bridge: { l: 'NPTEL courses', u: 'https://nptel.ac.in/' } },
  { id: 'cc',     name: 'Cloud Computing', why: 'Renting computers and services over the internet.', used: 'Most modern company software runs in the cloud.', bridge: { l: 'GitHub Student Developer Pack', u: 'https://education.github.com/pack' } },
  { id: 'crypto', name: 'Cryptography and Network Security', why: 'Protecting data with codes and keys.', used: 'Payments, messaging, login systems.', bridge: { l: 'OWASP Top 10', u: 'https://owasp.org/www-project-top-ten/' } },
  { id: 'test',   name: 'Software Testing', why: 'Checking that software works before users see it.', used: 'Every product team has testers or automation engineers.', bridge: { l: 'Playwright docs', u: 'https://playwright.dev/' } }
];

/* Careers. `tag` is the short name printed on the milestone stone.
   `subjects` are the syllabus subjects that matter most for the role.
   Each role has 8 weekly steps. */
PF.roles = [
  {
    id: 'web', icon: '🌐', tag: 'Web', name: 'Web developer',
    keywords: ['web', 'website', 'html', 'css', 'javascript', 'react', 'frontend', 'front-end', 'developer', 'app'],
    short: 'Builds the websites and apps people use every day.',
    day: 'Turn a design into a working page, fix a bug someone reported, and talk with teammates about what to build next.',
    skills: ['HTML, CSS and JavaScript', 'Git and GitHub', 'One framework such as React', 'Basic databases and APIs'],
    entry: 'Junior developer, front-end developer, or intern at a product or service company.',
    subjects: ['ds', 'oop', 'dbms', 'web', 'se', 'cn'],
    steps: [
      { t: 'Build your first page', d: 'Make a one-page profile about yourself using HTML. Add a photo, a heading and a list of your interests.', r: { l: 'MDN Learn Web Development', u: 'https://developer.mozilla.org/en-US/docs/Learn' } },
      { t: 'Style it', d: 'Use CSS to add colours and a layout. Make it look good on a phone screen too.', r: { l: 'freeCodeCamp Responsive Web Design', u: 'https://www.freecodecamp.org/learn' } },
      { t: 'Add behaviour', d: 'Learn the JavaScript basics and build a small to-do list that remembers items.', r: { l: 'JavaScript on MDN', u: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript' } },
      { t: 'Talk to the internet', d: 'Fetch data from a free public API and show it on your page, such as weather or jokes.', r: { l: 'Public APIs list', u: 'https://github.com/public-apis/public-apis' } },
      { t: 'Use Git and publish', d: 'Put your project on GitHub and publish it for free on Cloudflare Pages or GitHub Pages.', r: { l: 'GitHub Docs: Hello World', u: 'https://docs.github.com/en/get-started/start-your-journey/hello-world' } },
      { t: 'Try a framework', d: 'Rebuild your to-do list in React and notice what gets easier.', r: { l: 'React Learn', u: 'https://react.dev/learn' } },
      { t: 'Save data', d: 'Add a simple backend or a free database so your notes stay after you close the page.', r: { l: 'roadmap.sh backend path', u: 'https://roadmap.sh/backend' } },
      { t: 'Ship a real project', d: 'Build something for a real need, like your college club or your village. Write a clear README.', r: { l: 'roadmap.sh frontend path', u: 'https://roadmap.sh/frontend' } }
    ]
  },
  {
    id: 'data', icon: '📊', tag: 'Data', name: 'Data analyst',
    keywords: ['data', 'analyst', 'analysis', 'sql', 'excel', 'power bi', 'dashboard', 'statistics', 'analytics'],
    short: 'Turns raw numbers into answers that help people decide.',
    day: 'Pull data with SQL, clean it, find the story in it, and present it as a chart or short report.',
    skills: ['Spreadsheets', 'SQL', 'Python with pandas', 'Charts and storytelling', 'Basic statistics'],
    entry: 'Junior data analyst, business analyst, or reporting analyst.',
    subjects: ['dbms', 'prob', 'c', 'dw', 'math', 'ds'],
    steps: [
      { t: 'Master the spreadsheet', d: 'Clean a small dataset in Google Sheets or Excel and build one pivot table.', r: { l: 'Google Sheets help', u: 'https://support.google.com/docs/' } },
      { t: 'Learn SQL basics', d: 'Practise SELECT, WHERE and GROUP BY until they feel natural.', r: { l: 'SQLBolt', u: 'https://sqlbolt.com/' } },
      { t: 'Combine tables', d: 'Practise JOINs with two or three tables and write down what each query answers.', r: { l: 'SQLBolt joins', u: 'https://sqlbolt.com/' } },
      { t: 'Python for data', d: 'Load a CSV file with pandas, clean missing values and count things.', r: { l: 'Kaggle Learn: Pandas', u: 'https://www.kaggle.com/learn/pandas' } },
      { t: 'Make charts', d: 'Show one finding as a clear chart. Fewer colours, bigger labels.', r: { l: 'Kaggle Learn: Data Visualization', u: 'https://www.kaggle.com/learn/data-visualization' } },
      { t: 'Statistics essentials', d: 'Understand average, median, spread and correlation, and when each one misleads.', r: { l: 'Khan Academy statistics', u: 'https://www.khanacademy.org/math/statistics-probability' } },
      { t: 'Analyse a public dataset', d: 'Pick a dataset about something you care about and ask three questions of it.', r: { l: 'data.gov.in', u: 'https://data.gov.in/' } },
      { t: 'Present your findings', d: 'Write a one-page summary of what you found and what you would do about it. Publish it on GitHub.', r: { l: 'GitHub Docs: Hello World', u: 'https://docs.github.com/en/get-started/start-your-journey/hello-world' } }
    ]
  },
  {
    id: 'ml', icon: '🤖', tag: 'AI/ML', name: 'AI and machine learning engineer',
    keywords: ['ai', 'ml', 'machine learning', 'deep learning', 'neural', 'model', 'data scientist', 'llm', 'chatgpt'],
    short: 'Builds software that learns from data to predict, classify or generate.',
    day: 'Prepare data, train and test a model, check where it fails, and help ship it inside a real product.',
    skills: ['Python', 'NumPy and pandas', 'Math intuition', 'scikit-learn', 'Using pretrained models'],
    entry: 'Junior ML engineer, data scientist trainee, or AI developer intern. Many people start as data or software engineers first.',
    subjects: ['c', 'math', 'prob', 'ml', 'ai', 'ds', 'algo'],
    steps: [
      { t: 'Python foundations', d: 'Write small programs with loops, functions and lists. Solve five simple problems.', r: { l: 'Kaggle Learn: Python', u: 'https://www.kaggle.com/learn/python' } },
      { t: 'Work with data', d: 'Use NumPy and pandas to load a dataset, clean it and summarise it.', r: { l: 'Kaggle Learn: Pandas', u: 'https://www.kaggle.com/learn/pandas' } },
      { t: 'Math intuition', d: 'Watch short visual explanations of vectors, matrices and probability. Aim for understanding, not memorising.', r: { l: '3Blue1Brown', u: 'https://www.3blue1brown.com/' } },
      { t: 'Train your first model', d: 'Use scikit-learn to predict something from a simple dataset.', r: { l: 'Kaggle Learn: Intro to Machine Learning', u: 'https://www.kaggle.com/learn/intro-to-machine-learning' } },
      { t: 'Test it honestly', d: 'Split data into train and test, see overfitting happen, and compare two metrics.', r: { l: 'Kaggle Learn: Intermediate ML', u: 'https://www.kaggle.com/learn/intermediate-machine-learning' } },
      { t: 'Meet neural networks', d: 'Follow one beginner lesson and train a tiny network on images or text.', r: { l: 'fast.ai course', u: 'https://course.fast.ai/' } },
      { t: 'Use pretrained models', d: 'Use a ready-made model from Hugging Face to build a small text or image tool.', r: { l: 'Hugging Face courses', u: 'https://huggingface.co/learn' } },
      { t: 'Ship a small AI app', d: 'Wrap one model in a simple web page and share the link with a friend.', r: { l: 'Hugging Face Spaces', u: 'https://huggingface.co/spaces' } }
    ]
  },
  {
    id: 'cloud', icon: '☁️', tag: 'Cloud', name: 'Cloud and DevOps engineer',
    keywords: ['cloud', 'devops', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'linux', 'server', 'deployment'],
    short: 'Keeps applications running reliably on the internet.',
    day: 'Set up servers, automate releases, watch dashboards, and fix problems before users notice.',
    skills: ['Linux', 'Networking basics', 'Git', 'Docker', 'CI/CD pipelines', 'One cloud platform'],
    entry: 'Junior DevOps engineer, cloud support associate, or system administrator trainee.',
    subjects: ['os', 'cn', 'cc', 'se', 'dbms', 'ca'],
    steps: [
      { t: 'Learn the Linux command line', d: 'Practise moving around folders, reading files and editing text from the terminal.', r: { l: 'Linux Journey', u: 'https://linuxjourney.com/' } },
      { t: 'Understand networking', d: 'Explain in your own words what an IP address, DNS and HTTP are.', r: { l: 'roadmap.sh cyber and network guides', u: 'https://roadmap.sh/' } },
      { t: 'Use Git properly', d: 'Create branches, make commits and open a pull request on a practice repo.', r: { l: 'GitHub Docs: Hello World', u: 'https://docs.github.com/en/get-started/start-your-journey/hello-world' } },
      { t: 'Deploy something to the cloud', d: 'Put a small site online using a free tier or student credits.', r: { l: 'GitHub Student Developer Pack', u: 'https://education.github.com/pack' } },
      { t: 'Package with Docker', d: 'Put a tiny app inside a container and run it on your machine.', r: { l: 'Docker get started', u: 'https://docs.docker.com/get-started/' } },
      { t: 'Automate with CI/CD', d: 'Use GitHub Actions to run tests whenever you push code.', r: { l: 'GitHub Actions docs', u: 'https://docs.github.com/en/actions' } },
      { t: 'Watch your app', d: 'Add a health check and a simple log so you can tell when something breaks.', r: { l: 'roadmap.sh DevOps path', u: 'https://roadmap.sh/devops' } },
      { t: 'Build a full pipeline', d: 'Commit code, test it automatically and deploy it without clicking anything by hand.', r: { l: 'roadmap.sh DevOps path', u: 'https://roadmap.sh/devops' } }
    ]
  },
  {
    id: 'cyber', icon: '🔐', tag: 'Security', name: 'Cybersecurity analyst',
    keywords: ['security', 'cyber', 'hacking', 'hacker', 'ethical', 'pentest', 'ctf', 'malware', 'encryption'],
    short: 'Protects people and systems from attacks.',
    day: 'Watch for suspicious activity, investigate alerts, test systems for weak spots and help teams fix them.',
    skills: ['Networking', 'Linux', 'How web attacks work', 'Cryptography basics', 'Careful documentation'],
    entry: 'Security analyst trainee, SOC analyst, or junior penetration tester.',
    subjects: ['cn', 'crypto', 'os', 'dbms', 'ds'],
    steps: [
      { t: 'Learn networking and Linux', d: 'Know how data moves between devices and how to use the Linux terminal.', r: { l: 'Linux Journey', u: 'https://linuxjourney.com/' } },
      { t: 'Read the OWASP Top 10', d: 'Read how common web attacks work and write one line on each in your own words.', r: { l: 'OWASP Top 10', u: 'https://owasp.org/www-project-top-ten/' } },
      { t: 'Start a guided lab', d: 'Complete a beginner path on a safe, legal practice platform.', r: { l: 'TryHackMe', u: 'https://tryhackme.com/' } },
      { t: 'Cryptography basics', d: 'Understand hashing, encryption and why HTTPS is safe.', r: { l: 'Khan Academy: Cryptography', u: 'https://www.khanacademy.org/computing/computer-science/cryptography' } },
      { t: 'Learn the tools, safely', d: 'Practise with Wireshark and Nmap only on your own devices or lab machines.', r: { l: 'Wireshark docs', u: 'https://www.wireshark.org/docs/' } },
      { t: 'Practise web security', d: 'Solve a few labs on injection and broken login in a legal training site.', r: { l: 'PortSwigger Web Security Academy', u: 'https://portswigger.net/web-security' } },
      { t: 'Write it up', d: 'Document one lab you solved: what you tried, what worked and how to fix it.', r: { l: 'GitHub Docs: Hello World', u: 'https://docs.github.com/en/get-started/start-your-journey/hello-world' } },
      { t: 'Join a beginner CTF', d: 'Play a beginner capture-the-flag with a friend and note what you learned.', r: { l: 'picoCTF', u: 'https://picoctf.org/' } }
    ]
  },
  {
    id: 'qa', icon: '🔍', tag: 'QA', name: 'Software tester and QA engineer',
    keywords: ['test', 'testing', 'qa', 'quality', 'bug', 'automation', 'selenium', 'playwright', 'tester'],
    short: 'Makes sure software works before real people use it.',
    day: 'Think of ways a feature could break, test it, report bugs clearly, and write scripts that re-test automatically.',
    skills: ['Test case writing', 'Clear bug reports', 'SQL basics', 'One automation tool', 'API testing'],
    entry: 'Junior tester, QA analyst, or automation trainee. A good first step into software teams.',
    subjects: ['se', 'test', 'oop', 'dbms', 'web'],
    steps: [
      { t: 'Learn testing basics', d: 'Learn what a bug, a test case and a test plan are. Write three test cases for a login page.', r: { l: 'roadmap.sh QA path', u: 'https://roadmap.sh/qa' } },
      { t: 'Test a real app', d: 'Pick a website you use and write ten test cases. Report any bug in clear steps.', r: { l: 'roadmap.sh QA path', u: 'https://roadmap.sh/qa' } },
      { t: 'Learn SQL for checking data', d: 'Learn SELECT and WHERE so you can verify what the app saved.', r: { l: 'SQLBolt', u: 'https://sqlbolt.com/' } },
      { t: 'Start programming', d: 'Learn the basics of Python or JavaScript. Write a script that checks a few values.', r: { l: 'CS50 free course', u: 'https://cs50.harvard.edu/x/' } },
      { t: 'Automate a browser test', d: 'Write one automated test that opens a page and checks what is on it.', r: { l: 'Playwright docs', u: 'https://playwright.dev/' } },
      { t: 'Test an API', d: 'Send requests to a public API with Postman and check the responses.', r: { l: 'Postman Learning Center', u: 'https://learning.postman.com/' } },
      { t: 'Run tests automatically', d: 'Use GitHub Actions to run your tests every time you push code.', r: { l: 'GitHub Actions docs', u: 'https://docs.github.com/en/actions' } },
      { t: 'Build a test portfolio', d: 'Put your test cases, bug reports and automation scripts in one tidy GitHub repo.', r: { l: 'GitHub Docs: Hello World', u: 'https://docs.github.com/en/get-started/start-your-journey/hello-world' } }
    ]
  }
];

PF.roleById = function (id) { return PF.roles.find(function (r) { return r.id === id; }) || null; };
PF.subjectById = function (id) { return PF.subjects.find(function (s) { return s.id === id; }) || null; };
