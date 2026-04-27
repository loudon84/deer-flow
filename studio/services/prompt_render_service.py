from jinja2 import Template, TemplateSyntaxError
import json
from jsonschema import validate, ValidationError


class PromptRenderService:
    """提示词渲染服务"""

    def render_user_prompt(
        self, template: str, params: dict
    ) -> str:
        """渲染用户提示词模板"""
        try:
            jinja_template = Template(template)
            return jinja_template.render(**params)
        except TemplateSyntaxError as e:
            raise ValueError(f"Invalid template syntax: {e}")
        except Exception as e:
            raise ValueError(f"Failed to render template: {e}")

    def validate_params(self, schema: dict, params: dict) -> tuple[bool, str | None]:
        """验证输入参数"""
        try:
            validate(instance=params, schema=schema)
            return True, None
        except ValidationError as e:
            return False, str(e)

    def validate_and_render(
        self,
        schema: dict,
        template: str,
        params: dict,
    ) -> tuple[str | None, str | None]:
        """
        验证参数并渲染模板

        Returns:
            (渲染结果, 错误信息)
        """
        # 验证参数
        is_valid, error = self.validate_params(schema, params)
        if not is_valid:
            return None, f"Parameter validation failed: {error}"

        # 渲染模板
        try:
            result = self.render_user_prompt(template, params)
            return result, None
        except ValueError as e:
            return None, str(e)
