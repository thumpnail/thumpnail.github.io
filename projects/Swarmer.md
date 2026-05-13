# Swarmer
#idea #cli

**Swarmer** was an idea the resulted from using docker, justfiles(command runner) and jetbrains build configurations(who can run in paralel). So swarmer is basically that, an overengineered Asyncronous/Parallel **command-runner** with docker-like-configuration files. 

It behaves **like docker** in that regard but does not use containerisation but a command-runner-host(deamon), that hosts the commands as processes as long as they run as entities(in docker they would be services).

the 'Client' comunicates through **named-pipes** with the **Host-Deamon** to start new processes and retrieve informations about the running pocesses/'entities'.

> Sorry this is empty... i promise i will some stuff here once i get here.. dont you loose hope, knowledge is on its way!
