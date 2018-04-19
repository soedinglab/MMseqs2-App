MMseqs2 Search Server
=====================

Setup
-----

### Setting up the MMseqs2 Search Server

Install docker (>=17.05) and docker-compose (>=1.10.0) and git on your server.

If you want to run multiple worker instances, make sure to either use the AUFS or overlay/overlay2 storage drivers.
Without these, the database indices will be held multiple times in main memory and performance will degrade.

To check out the repository, run:
```
git clone https://github.com/milot-mirdita/mmseqs-web
cd mmseqs-web
```

If you want to use one of our default databases (Uniclust/Pfam/PDB/EggNOG) go to section [Setting Up Custom Databases](#setting-up-custom-databases) then return here.
If you want to use your own sequence databases go to section [Setting up a Custom Sequence Database](#setting-up-a-custom-sequence-database) then return here.
If you want to use your own profile databases go to section [Setting up a Custom Profile Database](#setting-up-a-custom-profile-database) then return here.

Take a look at the [MMseqs2 User Guide](https://github.com/soedinglab/mmseqs2/wiki) to make sure you have enough system memory for all databases.

Once you have set up your search databases you can start the MMseqs2 Search Server by executing:

```
sudo docker-compose up
```

You can now navigate with a web browser to your server's IP address and use the MMseqs2 Search Server.

### Updating the MMseqs2 Search Server
To make sure you are running the latest version of the MMseqs2 Web Server execute the following commands.

```
docker-compose pull
docker-compose up --build
```

## Setting up the Example Databases

### Uniclust

We provide a script in `examples/uniclust/setup.sh` that will download and setup the Uniclust sequence database for you.
Please take a look at this script and choose version, sequence identity level and kind of the database you want.

We provide databases at 30%, 50% and 90% sequence identity, both as seed databases (the cluster reference sequence is the original Uniprot header and sequence) and as a consensus database (the cluster reference sequence is a Uniclust consensus sequence with a summarized header).

After you choose the parameters to your liking, navigate to the databases folder and execute the setup script:

```
cd databases
../examples/uniclust/setup.sh
```

When the script finishes, you can optionally edit the generated params file. Take a look at the "Params File" section.

### PDB70

We provide a script in examples/pdb70/setup.sh that will download and setup the PDB70 profile database for you.

After you choose the parameters to your liking, navigate to the databases folder and execute the setup script:

```
cd databases
../examples/pdb70/setup.sh
```

### PFAM

We provide a script in examples/pfam/setup.sh that will download and setup the Pfam profile database for you.

After you choose the parameters to your liking, navigate to the databases folder and execute the setup script:

```
cd databases
../examples/pfam/setup.sh
```

### EggNOG

We provide a script in examples/eggnog/setup.sh that will download and setup the EggNOG profile database for you.

Since building the EggNOG database is slightly more involved, we use a docker container to set it up.

```
cd examples/eggnog
./setup.sh
```

## Setting up Custom Databases

### Setting Up a Custom Sequence Database

To add a new sequence database to your local MMseqs2 Search Server, place your sequences as a FASTA file with the .fasta file ending in the databases folder.

Then create a .params file with the same basename (filename without the .fasta ending) in the same folder.

The following command will create an empty .params file that you can customize:
```
BASEFASTA="sequence_db"
echo -e "{\n \"display\": {\n  \"name\": \"\",\n  \"version\": \"\",\n  \"default\": true,\n  \"order\": 0\n, \"search\": \"\"\n }\n}" > "${BASEFASTA}.params"
```

Take a look at the "Params File" to customize this file.

### Setting up a Custom Profile Database
To add a profile database to your local MMseqs2 Search Server, you need to provide multiple sequence alignments for each target profile inside an MMseqs2 indexed database. Place your MSAs as one STOCKHOLM file with the .sto file ending in the databases folder. 

Params File
-----------

The params file is a json file with the following format:
