# paster CLI

Paste from a terminal to any running paster instance.

## Install

Install from this checkout with Node.js 20 or later:

```sh
npm install -g ./cli
```

Set the server with `paster config host https://paster.meher.tech`, `PASTER_HOST`, or `-H`. The default is `https://paster.meher.tech`.

Every instance also serves a POSIX shell client at `/install.sh`. It requires `curl`; use the Node CLI for end-to-end encryption.

## Examples

```sh
ls -la | paster
paster main.go --expires 1d
paster clip -E -c
paster text "hello there" -b
paster get https://paster.meher.tech/AbCd1234#key
paster ls
paster rm AbCd1234
paster token AbCd1234
```

- `-E` encrypts with AES-256-GCM before upload; the key stays in the URL fragment.
- `-p` or `-P` encrypts using a password.
- Edit tokens and link keys are kept in `~/.config/paster/history.json` (`%APPDATA%\paster` on Windows), with restrictive file permissions where supported.
- Existing `pastr` CLI settings and history are read automatically; new data is saved in the `paster` config directory.

Source code: [github.com/mehermankar/paster](https://github.com/mehermankar/paster)
