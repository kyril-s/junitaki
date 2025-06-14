# Team Timer

A web-based timer tool for team meetings and presentations.

## Features

- Multiple meeting type templates (Critique, Design Review, etc.)
- Customizable task durations
- Individual task controls
- Pause/Resume functionality
- Visual task status indicators
- Responsive design for all devices

## Local Development

1. Clone the repository:
```bash
git clone [your-repo-url]
cd team-timer
```

2. Open `index.html` in your browser or use a local server:
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

3. Access the timer at `http://localhost:8000`

## Deployment

### Option 1: GitHub Pages (Recommended for simple setup)

1. Create a new repository on GitHub
2. Push your code:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin [your-repo-url]
git push -u origin main
```

3. Go to repository Settings > Pages
4. Select the main branch as source
5. Your timer will be available at `https://[your-username].github.io/[repo-name]`

### Option 2: Netlify (Recommended for automatic deployments)

1. Create a Netlify account
2. Connect your GitHub repository
3. Deploy settings:
   - Build command: (leave empty)
   - Publish directory: ./
4. Your timer will be available at `https://[your-site-name].netlify.app`

## Usage

1. Select a meeting type or create custom tasks
2. Adjust task durations as needed
3. Click the play button on a task to start its timer
4. Use pause to temporarily stop the timer
5. Use stop to completely stop the current task
6. Use skip to move to the next task

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Contributing

Feel free to submit issues and enhancement requests! # junitaki
