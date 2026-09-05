# 개발 환경 세팅

다른 기기에서 이 레포를 처음 세팅하는 절차. **레포 밖에 남는 설정은 2개뿐**이므로(git 아이덴티티, SSH 키) 아래 4·5번만 수동 작업입니다.

## 0. 사전 요구

| 도구 | 확인                                                    |
| ---- | ------------------------------------------------------- |
| git  | `git --version`                                         |
| nvm  | `command -v nvm` — 없으면 https://github.com/nvm-sh/nvm |

## 1. 클론

동기화 폴더(`~/Documents`, `~/Desktop`, Dropbox, Google Drive) **밖에** 두어야 합니다.
클라우드 동기화의 "저장 공간 최적화"가 `.git` 객체를 로컬에서 내리면 레포가 깨집니다.

```bash
mkdir -p ~/itsme/project && cd ~/itsme/project
git clone git@github.com:alltoy79/labs.git
cd labs
```

## 2. Node

```bash
nvm install        # .nvmrc 를 읽어 Node 22 설치
nvm use            # 이 레포에서 작업할 때마다 실행
node -v            # v22.x 확인
```

> **nvm 기본 버전(`nvm alias default`)을 바꾸지 마세요.** 회사 프로젝트가 다른 버전을 쓸 수 있습니다.
> **자동전환 hook도 넣지 마세요.** 회사 디렉터리로 이동할 때 Node 가 바뀝니다.

## 3. pnpm + 의존성

```bash
corepack enable pnpm
pnpm install
```

pnpm 버전은 `package.json` 의 `packageManager` 필드로 고정되어 있습니다.

> pnpm shim 은 Node 22 디렉터리 안에만 설치됩니다. 다른 Node 버전에서는 `pnpm` 명령이 존재하지 않으므로, 실수로 잘못된 Node 로 이 레포를 돌릴 수 없습니다.

## 4. git 아이덴티티 (수동 · 기기별)

전역 설정은 그대로 두고, `~/itsme/` 하위에만 개인 아이덴티티를 적용합니다.

```bash
cat > ~/.gitconfig-personal <<'EOF'
[user]
	name = alltoy79
	email = 324830161+alltoy79@users.noreply.github.com
EOF

cat >> ~/.gitconfig <<'EOF'

[includeIf "gitdir:~/itsme/"]
	path = ~/.gitconfig-personal
EOF
```

**검증** — 반드시 확인하세요:

```bash
cd ~/itsme/project/labs && git config --get user.email
# → 324830161+alltoy79@users.noreply.github.com  (개인)

cd ~/<회사레포> && git config --get user.email
# → 회사 이메일 그대로여야 함
```

## 5. SSH 키 (수동 · 기기별)

개인 계정 전용 키를 새로 만듭니다. 기존 키를 재사용하지 마세요.

```bash
ssh-keygen -t ed25519 -C "alltoy79@github" -f ~/.ssh/id_ed25519_github_personal
```

`~/.ssh/config` 에 **추가**합니다(기존 항목 수정 금지):

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github_personal
    IdentitiesOnly yes
```

공개키를 GitHub 에 등록: `pbcopy < ~/.ssh/id_ed25519_github_personal.pub` → github.com/settings/keys

```bash
ssh -T git@github.com     # "Hi alltoy79!" 확인
```

## 6. 시크릿

```bash
cp .env.example .env.local   # 존재할 경우
```

실제 값은 `.env.local` 에만 넣습니다. **전역 환경변수(`~/.zshrc`)로 내보내지 마세요** — 회사 작업 세션에도 노출됩니다.
운영 값은 Vercel 대시보드에서 관리합니다.

## 7. 최종 확인

```bash
pnpm typecheck
pnpm build
git log -1 --format='%an <%ae>'    # alltoy79 로 나와야 함
```

## GitHub 계정 설정 (한 번만)

github.com/settings/emails 에서:

- ☑ Keep my email addresses private
- ☑ Block command line pushes that expose my email ← 회사 이메일로 커밋 시 push 거부

## 회사 환경과의 격리 원칙

| 영역           | 분리 방식                                     |
| -------------- | --------------------------------------------- |
| Node           | 기본값 유지 + 레포 `.nvmrc`, 자동전환 없음    |
| pnpm           | Node 22 디렉터리 내부에만 존재                |
| git 아이덴티티 | `includeIf` 경로 조건부                       |
| SSH            | `~/.ssh/config` 에 항목 추가만                |
| 시크릿         | 레포 `.env.local` 만                          |
| Claude Code    | 레포 `.claude/settings.json` 만 (전역 무수정) |

전역 설정 변경이 필요해 보이면, 레포 로컬로 해결할 방법을 먼저 찾으세요.
