from article_studio.db.mongo import get_mongo_manager

# 集合名常量
COLLECTION_ARTICLE_TEMPLATES = "article_templates"
COLLECTION_ARTICLE_TEMPLATE_VERSIONS = "article_template_versions"
COLLECTION_ARTICLE_JOBS = "article_jobs"
COLLECTION_ARTICLE_DOCUMENTS = "article_documents"
COLLECTION_ARTICLE_APPROVALS = "article_approvals"
COLLECTION_ARTICLE_RAGFLOW_TASKS = "article_ragflow_tasks"


def get_collection(name: str):
    """获取集合"""
    return get_mongo_manager().db[name]
