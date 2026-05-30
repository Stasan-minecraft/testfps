from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, init_db
from models import User, Post, Comment, Like, Follow
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_optional_user,
)
from schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserOut,
    UserUpdate,
    PostCreate,
    PostOut,
    CommentCreate,
    CommentOut,
    MessageResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="SocialNet API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────── helpers ──────────────────────────

async def _user_to_out(
    user: User, db: AsyncSession, current_user: Optional[User] = None
) -> UserOut:
    followers_q = await db.execute(
        select(func.count()).where(Follow.following_id == user.id)
    )
    following_q = await db.execute(
        select(func.count()).where(Follow.follower_id == user.id)
    )
    is_following = False
    if current_user and current_user.id != user.id:
        fq = await db.execute(
            select(Follow).where(
                Follow.follower_id == current_user.id,
                Follow.following_id == user.id,
            )
        )
        is_following = fq.scalar_one_or_none() is not None

    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        bio=user.bio or "",
        avatar_url=user.avatar_url or "",
        created_at=user.created_at,
        followers_count=followers_q.scalar() or 0,
        following_count=following_q.scalar() or 0,
        is_following=is_following,
    )


async def _post_to_out(
    post: Post, db: AsyncSession, current_user: Optional[User] = None
) -> PostOut:
    likes_q = await db.execute(
        select(func.count()).where(Like.post_id == post.id)
    )
    comments_q = await db.execute(
        select(func.count()).where(Comment.post_id == post.id)
    )
    is_liked = False
    if current_user:
        lq = await db.execute(
            select(Like).where(Like.user_id == current_user.id, Like.post_id == post.id)
        )
        is_liked = lq.scalar_one_or_none() is not None

    author_out = await _user_to_out(post.author, db, current_user)
    return PostOut(
        id=post.id,
        content=post.content,
        image_url=post.image_url or "",
        author=author_out,
        created_at=post.created_at,
        likes_count=likes_q.scalar() or 0,
        comments_count=comments_q.scalar() or 0,
        is_liked=is_liked,
    )


# ────────────────────────── AUTH ──────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where((User.username == req.username) | (User.email == req.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already taken")

    user = User(
        username=req.username,
        display_name=req.display_name,
        email=req.email,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    user_out = await _user_to_out(user, db)
    return TokenResponse(access_token=token, user=user_out)


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    user_out = await _user_to_out(user, db)
    return TokenResponse(access_token=token, user=user_out)


@app.get("/api/auth/me", response_model=UserOut)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _user_to_out(current_user, db, current_user)


# ────────────────────────── USERS ──────────────────────────

@app.get("/api/users/{username}", response_model=UserOut)
async def get_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await _user_to_out(user, db, current_user)


@app.put("/api/users/me", response_model=UserOut)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        current_user.display_name = data.display_name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    await db.commit()
    await db.refresh(current_user)
    return await _user_to_out(current_user, db, current_user)


@app.get("/api/users", response_model=list[UserOut])
async def search_users(
    q: str = Query("", min_length=0),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if q:
        result = await db.execute(
            select(User)
            .where(User.username.ilike(f"%{q}%") | User.display_name.ilike(f"%{q}%"))
            .limit(20)
        )
    else:
        result = await db.execute(select(User).order_by(User.created_at.desc()).limit(20))
    users = result.scalars().all()
    return [await _user_to_out(u, db, current_user) for u in users]


# ────────────────────────── FOLLOW ──────────────────────────

@app.post("/api/users/{username}/follow", response_model=MessageResponse)
async def follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == username))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id, Follow.following_id == target.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already following")

    db.add(Follow(follower_id=current_user.id, following_id=target.id))
    await db.commit()
    return MessageResponse(message=f"Now following {username}")


@app.delete("/api/users/{username}/follow", response_model=MessageResponse)
async def unfollow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == username))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.execute(
        delete(Follow).where(
            Follow.follower_id == current_user.id, Follow.following_id == target.id
        )
    )
    await db.commit()
    return MessageResponse(message=f"Unfollowed {username}")


@app.get("/api/users/{username}/followers", response_model=list[UserOut])
async def get_followers(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_q = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(Follow.following_id == user.id)
    )
    return [await _user_to_out(u, db, current_user) for u in followers_q.scalars().all()]


@app.get("/api/users/{username}/following", response_model=list[UserOut])
async def get_following(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    following_q = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(Follow.follower_id == user.id)
    )
    return [await _user_to_out(u, db, current_user) for u in following_q.scalars().all()]


# ────────────────────────── POSTS ──────────────────────────

@app.post("/api/posts", response_model=PostOut, status_code=201)
async def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = Post(content=data.content, image_url=data.image_url or "", author_id=current_user.id)
    db.add(post)
    await db.commit()
    await db.refresh(post, ["author"])
    return await _post_to_out(post, db, current_user)


@app.get("/api/posts", response_model=list[PostOut])
async def get_all_posts(
    offset: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    posts = result.scalars().all()
    return [await _post_to_out(p, db, current_user) for p in posts]


@app.get("/api/feed", response_model=list[PostOut])
async def get_feed(
    offset: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    following_ids = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == current_user.id)
    )
    ids = [r for r in following_ids.scalars().all()]
    ids.append(current_user.id)

    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.author_id.in_(ids))
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    posts = result.scalars().all()
    return [await _post_to_out(p, db, current_user) for p in posts]


@app.get("/api/posts/{post_id}", response_model=PostOut)
async def get_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Post).options(selectinload(Post.author)).where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return await _post_to_out(post, db, current_user)


@app.delete("/api/posts/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your post")
    await db.delete(post)
    await db.commit()
    return MessageResponse(message="Post deleted")


@app.get("/api/users/{username}/posts", response_model=list[PostOut])
async def get_user_posts(
    username: str,
    offset: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts_q = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.author_id == user.id)
        .order_by(Post.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [await _post_to_out(p, db, current_user) for p in posts_q.scalars().all()]


# ────────────────────────── LIKES ──────────────────────────

@app.post("/api/posts/{post_id}/like", response_model=MessageResponse)
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Post not found")

    existing = await db.execute(
        select(Like).where(Like.user_id == current_user.id, Like.post_id == post_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already liked")

    db.add(Like(user_id=current_user.id, post_id=post_id))
    await db.commit()
    return MessageResponse(message="Post liked")


@app.delete("/api/posts/{post_id}/like", response_model=MessageResponse)
async def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Like).where(Like.user_id == current_user.id, Like.post_id == post_id)
    )
    await db.commit()
    return MessageResponse(message="Like removed")


# ────────────────────────── COMMENTS ──────────────────────────

@app.post("/api/posts/{post_id}/comments", response_model=CommentOut, status_code=201)
async def create_comment(
    post_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(content=data.content, author_id=current_user.id, post_id=post_id)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, ["author"])
    author_out = await _user_to_out(comment.author, db, current_user)
    return CommentOut(
        id=comment.id,
        content=comment.content,
        author=author_out,
        post_id=comment.post_id,
        created_at=comment.created_at,
    )


@app.get("/api/posts/{post_id}/comments", response_model=list[CommentOut])
async def get_comments(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    out = []
    for c in comments:
        author_out = await _user_to_out(c.author, db, current_user)
        out.append(
            CommentOut(
                id=c.id,
                content=c.content,
                author=author_out,
                post_id=c.post_id,
                created_at=c.created_at,
            )
        )
    return out


@app.delete("/api/posts/{post_id}/comments/{comment_id}", response_model=MessageResponse)
async def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.post_id == post_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    await db.delete(comment)
    await db.commit()
    return MessageResponse(message="Comment deleted")


# ────────────────────────── HEALTH ──────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}
