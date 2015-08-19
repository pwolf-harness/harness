package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	log "github.com/drone/drone/Godeps/_workspace/src/github.com/Sirupsen/logrus"
	"github.com/drone/drone/Godeps/_workspace/src/github.com/samalba/dockerclient"
	common "github.com/drone/drone/pkg/types"
)

var (
	clone   = flag.Bool("clone", false, "")
	build   = flag.Bool("build", false, "")
	publish = flag.Bool("publish", false, "")
	deploy  = flag.Bool("deploy", false, "")
	notify  = flag.Bool("notify", false, "")
	debug   = flag.Bool("debug", false, "")
)

func main() {
	flag.Parse()

	if *debug {
		log.SetLevel(log.DebugLevel)
	}

	ctx, err := parseContext()
	if err != nil {
		log.Errorln("Error launching build container.", err)
		os.Exit(1)
		return
	}

	// creates the Docker client, connecting to the
	// linked Docker daemon
	docker, err := dockerclient.NewDockerClient("unix:///var/run/docker.sock", nil)
	if err != nil {
		log.Errorln("Error connecting to build server.", err)
		os.Exit(1)
		return
	}

	// creates a wrapper Docker client that uses an ambassador
	// container to create a pod-like environment.
	client, err := newClient(docker)
	if err != nil {
		log.Errorln("Error starting build server pod", err)
		os.Exit(1)
		return
	}
	ctx.client = client
	defer client.Destroy()

	// performs some initial parsing and pre-processing steps
	// prior to executing our build tasks.
	err = setup(ctx)
	if err != nil {
		log.Errorln("Error processing .drone.yml file.", err)
		client.Destroy()
		os.Exit(1)
		return
	}
	createClone(ctx)

	var execs []execFunc
	if *clone {
		execs = append(execs, execClone)
	}
	if *build {
		execs = append(execs, execSetup)
		execs = append(execs, execCompose)
		execs = append(execs, execBuild)
	}
	if *publish {
		execs = append(execs, execPublish)
	}
	if *deploy {
		execs = append(execs, execDeploy)
	}

	// Loop through and execute each step.
	for i, exec_ := range execs {
		code, err := exec_(ctx)
		if err != nil {
			fmt.Printf("00%d Error executing build\n", i+1)
			fmt.Println(err)
			code = 255
		}
		if code != 0 {
			ctx.Job.ExitCode = code
			break
		}
	}

	// Optionally execute notification steps.
	if *notify {
		execNotify(ctx)
	}

	client.Destroy()
	os.Exit(ctx.Job.ExitCode)
}

func createClone(c *Context) error {
	c.Clone = &common.Clone{
		Netrc:   c.Netrc,
		Keypair: c.Keys,
		Remote:  c.Repo.Clone,
		Origin:  c.Repo.Clone,
	}

	c.Clone.Origin = c.Repo.Clone
	c.Clone.Remote = c.Repo.Clone
	c.Clone.Sha = c.Build.Commit.Sha
	c.Clone.Ref = c.Build.Commit.Ref
	c.Clone.Branch = c.Build.Commit.Branch
	// TODO do we still need this? it should be set by the remote
	if strings.HasPrefix(c.Clone.Branch, "refs/heads/") {
		c.Clone.Branch = c.Clone.Branch[11:]
	}

	// TODO we should also pass the SourceSha, SourceBranch, etc
	// to the clone object for merge requests from bitbucket, gitlab, et al
	// if len(c.Commit.PullRequest) != 0 {
	// }
	pathv, ok := c.Conf.Clone.Config["path"]
	if ok {
		path, ok := pathv.(string)
		if ok {
			c.Clone.Dir = path
			return nil
		}
	}
	return fmt.Errorf("Workspace path not found")
}

func parseContext() (*Context, error) {
	c := &Context{}
	for i, arg := range os.Args {
		if arg == "--" && len(os.Args) != i+1 {
			buf := bytes.NewBufferString(os.Args[i+1])
			err := json.NewDecoder(buf).Decode(c)
			return c, err
		}
	}
	err := json.NewDecoder(os.Stdin).Decode(c)
	return c, err
}
