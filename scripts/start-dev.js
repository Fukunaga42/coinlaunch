#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting CoinLaunch Services...\n');

const services = [
    {
        name: 'API Service',
        path: path.join(__dirname, '../apps/api'),
        port: 5050,
        emoji: '📡'
    },
    {
        name: 'Twitter Service',
        path: path.join(__dirname, '../apps/twitter'),
        port: 5051,
        emoji: '🐦'
    }
];

const processes = [];

// Start each service
services.forEach((service, index) => {
    setTimeout(() => {
        console.log(`${service.emoji} Starting ${service.name} on port ${service.port}...`);
        
        const proc = spawn('npm', ['run', 'dev'], {
            cwd: service.path,
            stdio: 'inherit',
            shell: true
        });
        
        processes.push(proc);
        
        proc.on('error', (err) => {
            console.error(`❌ Failed to start ${service.name}:`, err);
        });
    }, index * 2000); // Stagger starts by 2 seconds
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping all services...');
    
    processes.forEach(proc => {
        proc.kill('SIGTERM');
    });
    
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// Keep the main process running
process.stdin.resume(); 