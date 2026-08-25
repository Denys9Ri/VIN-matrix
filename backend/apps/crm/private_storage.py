from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateAcceptancePhotoStorage(FileSystemStorage):
    """Filesystem storage outside public MEDIA_ROOT.

    The storage is intentionally private: files are only returned through an
    authenticated API view. In production this directory must be mounted as
    persistent storage (or this storage can later be swapped for S3/R2 without
    changing the photo model/API contract).
    """

    def __init__(self):
        super().__init__(
            location=str(Path(settings.BASE_DIR) / 'private_media' / 'acceptance_photos'),
            base_url=None,
        )


acceptance_photo_storage = PrivateAcceptancePhotoStorage()
