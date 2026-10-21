# Hosting the signing worker on Google Cloud

A single **Spot T4 VM** runs the worker container. It keeps the model on its own disk, restarts itself after Google reclaims it, and is reached over HTTPS by the Next app on Vercel. Expected cost is about $5–8 a day (see the cost analysis in the chat history or recompute with the [pricing calculator](https://cloud.google.com/products/calculator)).

Placeholders used below: `PROJECT` (your project id), `ZONE` (for example `asia-southeast1-b`), `REGION` (for example `asia-southeast1`), `IP` (the VM's static address).

Most commands run in **Cloud Shell** (the `>_` button at the top of the Google Cloud console). It already has `gcloud` and needs no installation.

## 1. Account, billing, and safety limits

1. Sign in at <https://console.cloud.google.com> and create a project named, for example, `polaris-signing`.
2. **Upgrade the free trial**: Billing → *Activate full account* (or the *Upgrade* banner). Remaining trial credit carries over. GPUs do not work until you do this.
3. **Budget alerts**: Billing → Budgets & alerts → *Create budget*, amount $300, alert thresholds 33 %, 66 %, 90 %. Alerts email you; they do not stop spending, so act on them.
4. Enable the APIs (Cloud Shell):

   ```bash
   gcloud config set project PROJECT
   gcloud services enable compute.googleapis.com cloudscheduler.googleapis.com
   ```

## 2. GPU quota

IAM & Admin → Quotas & System Limits. Filter and request an increase to **1** for:

- `GPUs (all regions)`, the global quota.
- `Preemptible NVIDIA T4 GPUs` in your region. Spot VMs use this quota, not the normal T4 one.

Approval can take minutes or days. If it is refused, reply to the request saying it is for a university project demo, or try another region with T4s (`asia-south1` Mumbai, `us-central1`).

## 3. Create the VM

Choose a region near the judges; the walkthrough uses Singapore (`asia-southeast1`). Reserve a static IP so the HTTPS address never changes across restarts:

```bash
gcloud compute addresses create polaris-signing-ip --region=REGION
gcloud compute addresses describe polaris-signing-ip --region=REGION --format="value(address)"
```

Find a current Deep Learning VM image (it includes the NVIDIA driver and Docker). Pick the newest family containing `cu12` and `ubuntu-2204`:

```bash
gcloud compute images list --project=deeplearning-platform-release --no-standard-images --filter="family~cu12 AND family~ubuntu-2204" --format="value(family)" | sort -u
```

Create the VM (replace `IMAGE_FAMILY` with that name):

```bash
gcloud compute instances create polaris-signing --zone=ZONE \
  --machine-type=n1-standard-4 --accelerator=type=nvidia-tesla-t4,count=1 \
  --provisioning-model=SPOT --instance-termination-action=STOP --maintenance-policy=TERMINATE \
  --boot-disk-size=80GB --boot-disk-type=pd-balanced \
  --image-family=IMAGE_FAMILY --image-project=deeplearning-platform-release \
  --metadata=install-nvidia-driver=True --address=polaris-signing-ip --tags=https-server,http-server
gcloud compute firewall-rules create allow-web --allow=tcp:80,tcp:443 --target-tags=https-server,http-server
```

`STOP` (not delete) on preemption keeps the disk, so models are downloaded once. If a zone says it has no T4 capacity, try another zone letter (`-a`, `-c`).

SSH in (Compute Engine → VM instances → **SSH**, or `gcloud compute ssh polaris-signing --zone=ZONE`). The first login may install the driver; accept, then check that the GPU is visible to Docker:

```bash
nvidia-smi
sudo docker run --rm --gpus all nvidia/cuda:12.8.1-base-ubuntu22.04 nvidia-smi
```

## 4. Upload the worker code and the SMPL-X file

On **your PC**, from the project root, after the hosting changes are committed:

```powershell
git archive -o signing-worker.zip HEAD services/signing assets/exams/ielts-listening
gcloud compute scp signing-worker.zip polaris-signing:~ --zone=ZONE
gcloud compute scp "C:\path\to\SMPLX_NEUTRAL.npz" polaris-signing:~ --zone=ZONE
```

SMPL-X is licensed per person. Register (free for research) at <https://smpl-x.is.tue.mpg.de/> and download your own copy rather than reusing someone else's. It goes only onto the VM's private disk, never into the image or repository.

On the **VM**:

```bash
sudo apt-get install -y unzip && mkdir -p ~/polaris && unzip -o ~/signing-worker.zip -d ~/polaris
sudo mkdir -p /opt/polaris-signing/smplx && sudo cp ~/SMPLX_NEUTRAL.npz /opt/polaris-signing/smplx/
openssl rand -hex 32 | tee ~/signing-token.txt
```

Keep the token. Vercel needs the same value.

## 5. Build and start the worker

```bash
cd ~/polaris
sudo docker build -f services/signing/Dockerfile -t polaris-signing .
sudo docker run -d --name polaris-signing --restart unless-stopped --gpus all \
  -p 127.0.0.1:8765:8765 -v /opt/polaris-signing:/app/.cache/signing \
  -e POLARIS_SIGNING_TOKEN="$(cat ~/signing-token.txt)" -e POLARIS_SIGNING_STEPS=10 polaris-signing
sudo docker logs -f polaris-signing
```

The first start clones SignSparK and downloads and verifies 16.7 GB of checkpoints (typically 5–15 minutes in a data centre). It is ready when the log shows Uvicorn running. Press Ctrl+C to leave the log; the container keeps running. `POLARIS_SIGNING_STEPS=10` keeps a T4 close to real time; 50 steps would buffer constantly.

## 6. HTTPS with Caddy

The free `sslip.io` hostname maps to your IP, so no domain purchase is needed. Write the IP with dashes, for example `34-87-1-2.sslip.io`:

```bash
sudo docker run -d --name caddy --restart unless-stopped --network host -v caddy_data:/data \
  caddy:2 caddy reverse-proxy --from IP-WITH-DASHES.sslip.io --to localhost:8765
```

Caddy obtains a Let's Encrypt certificate automatically. If you own a domain, point an `A` record at the IP and use that name instead.

Check it from anywhere (any 64 hex characters work as the owner):

```bash
curl -s https://IP-WITH-DASHES.sslip.io/health -H "Authorization: Bearer $(cat ~/signing-token.txt)" -H "X-Signing-Owner: $(printf '%064d' 0)"
```

Expected: `{"ready":true,"message":"Models installed","languages":["ase"]}`.

## 7. Connect the Vercel app

1. Vercel → Project → Settings → Environment Variables (Production):
   - `POLARIS_SIGNING_URL` = `https://IP-WITH-DASHES.sslip.io`
   - `POLARIS_SIGNING_TOKEN` = the token
2. Settings → Functions → Function Region: choose the one closest to the VM (`sin1` Singapore for `asia-southeast1`). Every signing section passes through a function, so a distant region adds latency.
3. Redeploy, sign in, open Action Lab → Video Learning, enable the interpreter, select ASL, and play a lesson.

## 8. Automatic restart after Spot preemption

Google can stop a Spot VM at any time. This scheduler job asks Compute Engine to start it every five minutes; starting a running VM does nothing. Docker then restarts both containers.

```bash
gcloud iam service-accounts create vm-starter --display-name="Starts polaris-signing"
gcloud projects add-iam-policy-binding PROJECT --member="serviceAccount:vm-starter@PROJECT.iam.gserviceaccount.com" --role="roles/compute.instanceAdmin.v1"
gcloud scheduler jobs create http polaris-signing-restart --location=REGION --schedule="*/5 * * * *" \
  --http-method=POST --uri="https://compute.googleapis.com/compute/v1/projects/PROJECT/zones/ZONE/instances/polaris-signing/start" \
  --oauth-service-account-email="vm-starter@PROJECT.iam.gserviceaccount.com" --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform"
```

After a preemption, expect about 5–10 minutes until signing works again: up to 5 minutes for the scheduler, a minute to boot, and 1–2 minutes to re-verify checkpoints. Cloud Scheduler includes three free jobs per billing account.

To see how often it happens: Compute Engine → VM instances → polaris-signing → Logs, or Logging with `protoPayload.methodName="compute.instances.preempted"`.

## 9. Day-to-day operations

| Task | Command |
|---|---|
| Stop deliberately (pause the scheduler first, or it restarts the VM) | `gcloud scheduler jobs pause polaris-signing-restart --location=REGION` then `gcloud compute instances stop polaris-signing --zone=ZONE` |
| Start again | `gcloud compute instances start polaris-signing --zone=ZONE` then `gcloud scheduler jobs resume polaris-signing-restart --location=REGION` |
| Worker log | `sudo docker logs --tail 100 polaris-signing` (on the VM) |
| Update the worker code | Repeat step 4's upload and unzip, then `sudo docker rm -f polaris-signing`, rebuild, and rerun step 5 |
| No preemption during known judging days | Stop the VM, then in the console: VM → *Edit* → Advanced → Management → VM provisioning model **Standard**, save, and start it (about $13/day). Switch back to Spot afterwards the same way |

**When the competition ends**, delete everything so nothing keeps billing: the scheduler job, the VM (its disk is deleted with it), the static IP (`gcloud compute addresses delete polaris-signing-ip --region=REGION`), and the firewall rule. A stopped VM still bills its 80 GB disk (about $8 a month) and the reserved IP.
