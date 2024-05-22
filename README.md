# App and Server for MMseqs2, Foldseek and ColabFold
[MMseqs2](https://github.com/soedinglab/MMseqs2) and [Foldseek](https://github.com/steineggerlab/foldseek) are software suites to search and annotate huge sequence and structure sets. We built a graphical interface for interactive data exploration. Check out a live instance for [MMseqs2](https://search.mmseqs.com) and for [Foldseek](https://search.foldseek.com). Additionally, this codebase holds the API server for [ColabFold](https://github.com/sokrypton/ColabFold).

The application runs either:
* on your server through docker-compose, where it can make your sequence, profile or structure databases easily accessible over the web
* on your workstation as a cross-platform desktop application with the help of [Electron](https://github.com/electron/electron)

<p align="center"><img src="https://raw.githubusercontent.com/soedinglab/mmseqs2-app/master/.github/stickers.png" height="384" /></p>

## Desktop App
Head over to the [release page](https://github.com/soedinglab/MMseqs2-App/releases) and download the latest version. We support Linux, macOS and Windows.

> [!IMPORTANT]
> The desktop app is currently not maintained. Currently, only the backend-only mode for ColabFold and the MMseqs2 and Foldseek webservers are being maintained. We will revisit the desktop app at some point in the future.

### Adding a search database
Once the app is installed, open the Settings panel. There you can add either sequence databases in FASTA format, such as our [Uniclust](https://uniclust.mmseqs.com/) databases or profile databases in Stockholm format, such as the [PFAM](ftp://ftp.ebi.ac.uk/pub/databases/Pfam/current_release/Pfam-A.full.gz).

## Web app quick start with docker-compose
Make sure you have `docker`, `docker-compose` and `git` installed on your server.
To start the MMseqs2/Foldseek web server execute the following commands. Afterwards you can navigate to http://localhost:8877 to access the interface.

``` bash
# clone the repository
git clone https://github.com/soedinglab/MMseqs2-App.git

# navigate to our docker recipes
cd MMseqs2-App/docker-compose

# (optional) edit the APP entry in the .env file to choose between mmseqs and foldseek

# list available databases
docker-compose run db-setup

# download PDB
docker-compose run db-setup PDB

# start the server with docker-compose
docker-compose up
```

By default, the server will start on port 8877. You can edit the `.env` file in the `docker-compose` directory to change this port.

Head over to the [docker-compose readme](https://github.com/soedinglab/MMseqs2-App/blob/master/docker-compose/README.md) for more details on running your own server, including how to add your own sequence, profile or structure databases. Take a look at the [API documentation](https://search.mmseqs.com/docs) to learn how to talk to the server backend.

## Building the desktop app

You need to have `git`, `go` (>=1.18), `node`, `npm` and `make` installed on your system.

Afterwards run the following commands, and the apps will appear in the `build` folder.

``` bash
# clone the repository
git clone https://github.com/soedinglab/MMseqs2-App.git
cd MMseqs2-App

# install all dependencies
npm install

# build the app for all platforms, choose either mmseqs or foldseek
FRONTEND_APP=mmseqs npm run electron:build
```

