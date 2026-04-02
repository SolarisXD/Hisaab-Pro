const fs = require('fs');
const path = require('path');

const dir = 'e:/code/PROJECTS/hisaab-pro/client';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'staff.html');

for (const file of files) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf-8');
    if (content.includes('staff.html')) continue;
    
    const insert = `
                <a href="/staff.html" class="nav-link" data-page="staff">
                    <span class="nav-icon"><i data-lucide="briefcase"></i></span> Staff & Payroll
                </a>`;
                
    content = content.replace(
        /(<a href="\/accounts\.html"[^>]*>\s+<span[^>]*><i[^>]*><\/i><\/span> Accounts\s+<\/a>)/g,
        '$1' + insert
    );
    
    // some views might have active classes or slightly different formatting
    content = content.replace(
        /(<a href="(accounts.html|\/accounts.html)" class="nav-link[^"]*" data-page="accounts">\s+<span[^>]*><i[^>]*><\/i><\/span> Accounts\s+<\/a>\s+<div class="nav-sub-menu">[\s\S]*?<\/div>)/g,
        '$1' + insert
    );
    
    fs.writeFileSync(p, content, 'utf-8');
    console.log('Updated ' + file);
}
