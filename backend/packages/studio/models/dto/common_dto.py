from pydantic import BaseModel


class OkResponse(BaseModel):
    """通用成功响应"""

    ok: bool = True


class IdResponse(BaseModel):
    """ID 响应"""

    id: str
