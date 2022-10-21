# web-scraper
Config files for my GitHub profile.

Steps to setup : 
1. Open command prompt/terminal in the folder here you want to clone the project.

2. use command to clone teh project: 
    git clone <repo_link>

3. Open the project root folder in the command prompt/ terminal and run commands in sequence: 
    
    to install dependencies : npm install
    to run the project : npm run start
    
    
Using the scraper:
(it's configured just for one website for now)
- open browser and go to url : localhost:3000
- you will find the link already in the input box. click on submit button
- check your command prompt/terminal, you will find it working there
- after the data scraping is done then you will find the file "user.xls" in the same directory as of the project
- you will see message "Scraping coompleted" in the browser once the scraping will be completed.

Note :- right now there is condition so that the scrapper will only scrap intial 300 data. This is done just to not load the server. Removing the condition will make it fetch all the data 
