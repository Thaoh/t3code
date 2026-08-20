# Customize a project icon

T3 Code selects a project icon automatically. It checks `t3.json`, common favicon and app icon
paths, and icon links in project HTML files.

To choose a different icon:

1. Open **Settings** and select **Projects**.
2. Select the project.
3. Under **Appearance**, select **Choose a project file**.
4. Search for an image file and select it.

T3 Code supports SVG, PNG, ICO, JPEG, GIF, AVIF, and WebP files. The selected path applies to
each checkout in the project group and appears on your connected clients.

To use automatic detection again, select **Automatic**.

# Change a project directory

If a project's folder was moved or deleted, threads in that project fail until the checkout path
is updated.

1. Open the project from **Settings → Projects**, or choose **Open project settings** on the error
   in the thread.
2. Under **Checkout**, select **Change folder**.
3. Choose the folder (desktop) or type the new path (browser) and press Enter.

The updated path applies to that checkout. Existing threads keep working against the new folder.
