import uvicorn
from article_studio.api import app
from article_studio.settings import ArticleStudioSettings


def main():
    """启动 Article Studio API 服务"""
    settings = ArticleStudioSettings()

    uvicorn.run(
        "article_studio.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
