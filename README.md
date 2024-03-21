## Requirements

- Docker Desktop 4.27.2
- Enable docker compose v2 - `docker compose enable-v2`
- Node version 20.11.1

## Setup Steps

0. Make sure you've stopped IIS and Solr:

   `iisreset /stop`

   `Stop-Service -Name "<the name of your service>"`

   or

   `nssm stop "<the name of your service>"`

1. (only on setup) Initialize your local docker environment: `.\init.ps1 -LicenseXmlPath <path_to_license>\.xml`
   - make sure that the path to your license file is not too long (ex. C:\licenses\license.xml) and not expired
2. (only on setup) Build your Tools Images: `docker compose -f .\docker-compose.build.yml build nodejs`
3. (only on setup) Build your Sitecore Images: `docker compose -f .\docker-compose.build.yml build`
   - When it's done, you can run `docker images virtualug*` and you should see something like this:
     | <div style="width:30px">REPOSITORY</div> | <div style="width:10px">TAG</div> | <div style="width:10px">IMAGE ID</div> | <div style="width:10px">CREATED</div> | <div style="width:15px">SIZE</size> |
     | ---------------------------------------- | --------------------------------- | -------------------------------------- | ------------------------------------- | ----------------------------------- |
     | virtualug-solr-init | latest | 5b437ae0ad9c | About a minute ago | 5.77GB |
     | virtualug-mssql-init | latest | 072e70edea5f | About a minute ago | 5.84GB |
     | virtualug-cm | latest | fba4a9fdb979 | 2 minutes ago | 9.44GB |
     | virtualug-id | latest | 7290cf235c37 | 9 days ago | 639MB |
4. (only on setup) Initialize your Sitecore Environment: `docker compose -f .\docker-compose.init.yml up`
   - This process will take a little bit. Ensure that you see "Set Sitecore admin password"
   - Once you do, hit Ctrl + C
5. Start Sitecore: `docker compose up -d --remove-orphans`
   - You won't need the `remove-orphans` after the first time you run this.
6. Sync the content
   - Run `dotnet tool restore`
   - Run `dotnet sitecore cloud login`
   - Run `dotnet sitecore connect --ref xmcloud --cm https://xmcloudcm.localhost --allow-write true -n local`
   - Run `dotnet sitecore ser push -i VirtualUG.Sitecore.Items.Master`
   - Run `dotnet sitecore ser push -i VirtualUG.Sitecore.Items.Structure`
   - Run `dotnet sitecore ser push -i VirtualUG.Sitecore.Items.Content` to sync the page items under /Home
   - Run `dotnet sitecore ser push -i VirtualUG.Sitecore.Items.Local`
7. Sync the content
8. Publish the .NET solution
   - Open the `Platform.sln` in Visual Studio
   - Right-click on the Platform project and select Publish
   - Choose the `Local.pubxml` publish profile and click the Publish button
9. Build the front end solution
   - cd `cd .\src\virtualug\`
   - Execute `npm i`
   - Execute `npm run build`
10. Rebuild the index data: `dotnet sitecore index rebuild`
11. Open https://www.xmcloud.localhost for the rendering host
12. Open https://xmcloudcm.localhost/sitecore for CM

## Performing Project Updates

If you made updates to any of the Dockerfiles or to the .env_source file that will affect the images, follow the steps below:

1. Stop your instance with `docker compose down`
2. Purge your .\docker\data\solr
3. Purge your .\docker\data\sql
4. Purge your .\docker\deploy\website folder
5. Delete your .env file (If you made changes to it, ensure they are part of the .\docker\.env file)
6. Start at Step 1 above

## Important Links

- Local GraphQL Playground: https://cm.virtualug.localhost/sitecore/api/graph/edge/ui

  Sample Query:

  `query{
   layout(site: "VirtualUG", routePath: "/", language: "en") {
      item {
         rendered
      }
   }
}`

  HTTP Headers:

  `{
   "sc_apikey":"1FC41CC1-F52E-4ABB-AF63-A9E8CA295F46"
}`

- Local Layout Service (for the Home item): https://cm.virtualug.localhost/sitecore/api/layout/render/jss?item=/&sc_apikey=1FC41CC1-F52E-4ABB-AF63-A9E8CA295F46&sc_mode=normal&sc_site=VirtualUG
